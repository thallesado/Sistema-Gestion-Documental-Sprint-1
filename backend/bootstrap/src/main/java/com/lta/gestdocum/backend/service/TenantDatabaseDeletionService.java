package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.config.TenantDatabaseRoutingDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.sql.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;
import java.util.stream.Stream;

/** Verifies, archives and removes only tenant databases explicitly in DELETING state. */
@Service
@Profile("tenant-worker")
@ConditionalOnProperty(name = "app.tenant-databases.provisioning-enabled", havingValue = "true")
public class TenantDatabaseDeletionService {
    private static final Logger log = LoggerFactory.getLogger(TenantDatabaseDeletionService.class);
    private final String controlUrl;
    private final String adminUsername;
    private final String adminPassword;
    private final String host;
    private final int port;
    private final String sslMode;
    private final Path storageRoot;
    private final TenantDatabaseRoutingDataSource router;
    private final JdbcTemplate control;

    public TenantDatabaseDeletionService(DataSourceProperties dataSource,
            @Value("${app.tenant-databases.admin-username:}") String adminUsername,
            @Value("${app.tenant-databases.admin-password:}") String adminPassword,
            @Value("${app.storage.local-path:./data/storage}") String storagePath,
            TenantDatabaseRoutingDataSource router,
            @org.springframework.beans.factory.annotation.Qualifier("controlDataSource") DataSource controlDataSource) {
        this.controlUrl = dataSource.determineUrl();
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        PgAddress address = PgAddress.from(controlUrl);
        this.host = address.host(); this.port = address.port(); this.sslMode = address.sslMode();
        this.storageRoot = Path.of(storagePath).toAbsolutePath().normalize();
        this.router = router;
        this.control = new JdbcTemplate(controlDataSource);
        if (adminUsername.isBlank()) throw new IllegalStateException("La limpieza requiere credenciales administrativas PostgreSQL configuradas fuera del código.");
    }

    @Scheduled(fixedDelayString = "${app.tenant-databases.deletion-poll-ms:60000}", initialDelayString = "${app.tenant-databases.deletion-initial-ms:45000}")
    public void processEligibleTenants() {
        List<UUID> tenants;
        try (Connection connection = adminConnection(controlUrl); PreparedStatement query = connection.prepareStatement(
                "SELECT tenant_id FROM app.tenant_database_registry WHERE storage_mode='ISOLATED' AND lifecycle_state IN ('DELETING','DELETION_FAILED') AND last_error_code IS DISTINCT FROM 'TENANT_AUDIT_CHAIN_INVALID' ORDER BY deletion_started_at NULLS FIRST LIMIT 10");
             ResultSet rows = query.executeQuery()) {
            tenants = new ArrayList<>();
            while (rows.next()) tenants.add(rows.getObject(1, UUID.class));
        } catch (Exception error) {
            log.debug("Tenant deletion scan is not available yet ({})", error.getClass().getSimpleName());
            return;
        }
        tenants.forEach(this::deleteTenant);
    }

    private void deleteTenant(UUID tenantId) {
        try (Connection lockConnection = adminConnection(controlUrl)) {
            if (!tryLock(lockConnection, tenantId)) return;
            String name = registeredDatabase(lockConnection, tenantId);
            if (name == null || !TenantDatabaseName.forTenant(tenantId).equals(name)) {
                throw new SQLException("TENANT_DATABASE_NAME_MISMATCH");
            }
            boolean exists = databaseExists(lockConnection, name);
            if (exists) {
                verifyAndArchiveAudit(tenantId, name);
                Backup backup = createAndVerifyBackup(tenantId, name);
                recordEvent(tenantId, "DATABASE_ARCHIVED", "{\"auditRows\":" + backup.auditRows()
                        + ",\"databaseSha256\":\"" + backup.databaseSha256()
                        + "\",\"filesSha256\":\"" + backup.filesSha256() + "\"}");
                router.closeTenantPool(tenantId);
                dropDatabase(lockConnection, tenantId, name);
                if (databaseExists(lockConnection, name)) throw new SQLException("TENANT_DATABASE_STILL_EXISTS_AFTER_DROP");
            } else if (!hasLifecycleEvent(tenantId, "DATABASE_ARCHIVED")) {
                throw new SQLException("DATABASE_MISSING_BEFORE_AUDIT_ARCHIVE");
            }

            removeTenantFiles(tenantId);
            removeTemporaryBackup(tenantId);
            markDeleted(tenantId);
            log.info("Tenant database deletion completed for tenant {}", tenantId);
        } catch (Exception error) {
            String code = safeCode(error);
            markDeletionFailed(tenantId, code);
            log.error("Tenant database deletion failed for tenant {} ({})", tenantId, code);
        }
    }

    private boolean tryLock(Connection connection, UUID tenantId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT pg_try_advisory_lock(726398,hashtext(?))")) {
            query.setString(1, tenantId.toString()); try (ResultSet row = query.executeQuery()) { return row.next() && row.getBoolean(1); }
        }
    }

    private String registeredDatabase(Connection connection, UUID tenantId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT database_name FROM app.tenant_database_registry WHERE tenant_id=? AND storage_mode='ISOLATED' AND lifecycle_state IN ('DELETING','DELETION_FAILED')")) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { return row.next() ? row.getString(1) : null; }
        }
    }

    private boolean databaseExists(Connection connection, String name) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname=?)")) {
            query.setString(1, name); try (ResultSet row = query.executeQuery()) { row.next(); return row.getBoolean(1); }
        }
    }

    private void verifyAndArchiveAudit(UUID tenantId, String databaseName) throws SQLException {
        try (Connection source = adminConnection(databaseUrl(databaseName));
             Connection destination = adminConnection(controlUrl)) {
            verifyAuditChain(source, tenantId);
            destination.setAutoCommit(false);
            try (PreparedStatement read = source.prepareStatement("SELECT id,user_id,platform_actor_id,action,entity_type,entity_id,occurred_at,client_timestamp,client_timezone,ip_address,user_agent,result,details,chain_seq,previous_hash,record_hash FROM public.audit_events WHERE tenant_id=? ORDER BY chain_seq");
                 PreparedStatement insert = destination.prepareStatement("INSERT INTO app.tenant_audit_archive(tenant_id,source_event_id,user_id,platform_actor_id,action,entity_type,entity_id,occurred_at,client_timestamp,client_timezone,ip_address,user_agent,result,details,chain_seq,previous_hash,record_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,source_event_id) DO NOTHING")) {
                read.setObject(1, tenantId);
                try (ResultSet rows = read.executeQuery()) {
                    while (rows.next()) {
                        insert.setObject(1, tenantId); insert.setLong(2, rows.getLong("id"));
                        insert.setObject(3, rows.getObject("user_id"));
                        insert.setObject(4, rows.getObject("platform_actor_id"));
                        insert.setObject(5, rows.getObject("action"));
                        insert.setObject(6, rows.getObject("entity_type"));
                        insert.setObject(7, rows.getObject("entity_id"));
                        insert.setObject(8, rows.getObject("occurred_at"));
                        insert.setObject(9, rows.getObject("client_timestamp"));
                        insert.setObject(10, rows.getObject("client_timezone"));
                        insert.setObject(11, rows.getObject("ip_address"));
                        insert.setObject(12, rows.getObject("user_agent"));
                        insert.setObject(13, rows.getObject("result"));
                        insert.setObject(14, rows.getObject("details"));
                        insert.setObject(15, rows.getObject("chain_seq"));
                        insert.setObject(16, rows.getObject("previous_hash"));
                        insert.setObject(17, rows.getObject("record_hash"));
                        insert.addBatch();
                    }
                }
                insert.executeBatch();
            }
            long expected = countAudit(source, tenantId);
            long archived = countArchived(destination, tenantId);
            if (expected != archived) throw new SQLException("TENANT_AUDIT_ARCHIVE_COUNT_MISMATCH");
            verifyArchivedChain(destination, tenantId);
            destination.commit();
        }
    }

    private void verifyAuditChain(Connection database, UUID tenantId) throws SQLException {
        String sql = "WITH chain AS (SELECT chain_seq,previous_hash,record_hash,row_number() OVER(ORDER BY chain_seq) expected_seq," +
                "lag(record_hash,1,'0000000000000000000000000000000000000000000000000000000000000000') OVER(ORDER BY chain_seq) expected_previous," +
                "encode(digest(app.canonical_audit_payload(chain_seq,previous_hash,tenant_id,user_id,action,entity_type,entity_id,occurred_at,result,ip_address,details),'sha256'),'hex') expected_record " +
                "FROM public.audit_events WHERE tenant_id=?) SELECT count(*) FROM chain WHERE chain_seq IS NULL OR previous_hash IS NULL OR record_hash IS NULL OR chain_seq<>expected_seq OR trim(previous_hash)<>expected_previous OR trim(record_hash)<>expected_record";
        try (PreparedStatement query = database.prepareStatement(sql)) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { if (!row.next() || row.getLong(1) != 0) throw new SQLException("TENANT_AUDIT_CHAIN_INVALID"); }
        }
        try (PreparedStatement query = database.prepareStatement("SELECT count(*) FROM public.audit_anchors a LEFT JOIN public.audit_events e ON e.tenant_id=a.tenant_id AND e.chain_seq=a.chain_seq WHERE a.tenant_id=? AND (e.id IS NULL OR trim(e.record_hash)<>trim(a.record_hash))")) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { if (!row.next() || row.getLong(1) != 0) throw new SQLException("TENANT_AUDIT_ANCHOR_INVALID"); }
        }
    }

    private void verifyArchivedChain(Connection database, UUID tenantId) throws SQLException {
        String sql = "WITH chain AS (SELECT chain_seq,previous_hash,record_hash,row_number() OVER(ORDER BY chain_seq) expected_seq," +
                "lag(record_hash,1,'0000000000000000000000000000000000000000000000000000000000000000') OVER(ORDER BY chain_seq) expected_previous," +
                "encode(digest(app.canonical_audit_payload(chain_seq,previous_hash,tenant_id,user_id,action,entity_type,entity_id,occurred_at,result,ip_address,details),'sha256'),'hex') expected_record " +
                "FROM app.tenant_audit_archive WHERE tenant_id=?) SELECT count(*) FROM chain WHERE chain_seq IS NULL OR previous_hash IS NULL OR record_hash IS NULL OR chain_seq<>expected_seq OR trim(previous_hash)<>expected_previous OR trim(record_hash)<>expected_record";
        try (PreparedStatement query = database.prepareStatement(sql)) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { if (!row.next() || row.getLong(1) != 0) throw new SQLException("TENANT_AUDIT_ARCHIVE_CHAIN_INVALID"); }
        }
    }

    private Backup createAndVerifyBackup(UUID tenantId, String databaseName) throws Exception {
        Path directory = safeTenantPath(storageRoot.resolve(".tenant-purge").resolve(tenantId.toString()));
        Files.createDirectories(directory);
        restrict(directory, true);
        String attempt = Long.toString(Instant.now().toEpochMilli());
        Path dump = directory.resolve("tenant-" + attempt + ".dump");
        Path files = directory.resolve("tenant-files-" + attempt + ".zip");
        runClient(List.of("pg_dump", "--format=custom", "--no-owner", "--no-acl", "--file=" + dump, "--dbname=" + databaseName));
        runClient(List.of("pg_restore", "--list", dump.toString()));
        Map<String, String> checksums = packageFiles(tenantId, files);
        verifyFilePackage(files, checksums);
        restrict(dump, false); restrict(files, false);
        return new Backup(countAuditedRows(tenantId), sha(dump), sha(files));
    }

    private Map<String, String> packageFiles(UUID tenantId, Path zipPath) throws Exception {
        List<Path> roots = tenantStorageRoots(tenantId);
        Map<String, String> checksums = new TreeMap<>();
        for (Path root : roots) {
            if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) continue;
            try (Stream<Path> paths = Files.walk(root)) {
                for (Path path : paths.toList()) {
                    if (Files.isSymbolicLink(path)) throw new SQLException("TENANT_STORAGE_CONTAINS_SYMLINK");
                    if (Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                        String relative = storageRoot.relativize(path).toString().replace('\\', '/');
                        if (!safeStorageRelative(relative, tenantId)) throw new SQLException("TENANT_STORAGE_PATH_INVALID");
                        checksums.put(relative, sha(path));
                    }
                }
            }
        }
        StringBuilder manifest = new StringBuilder();
        checksums.forEach((path, hash) -> manifest.append(hash).append("  ").append(path).append('\n'));
        try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(zipPath, StandardOpenOption.CREATE_NEW))) {
            zip.putNextEntry(new ZipEntry("manifest.sha256")); zip.write(manifest.toString().getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
            for (String relative : checksums.keySet()) {
                Path file = safeTenantPath(storageRoot.resolve(relative));
                zip.putNextEntry(new ZipEntry("files/" + relative)); Files.copy(file, zip); zip.closeEntry();
            }
        }
        return checksums;
    }

    private void verifyFilePackage(Path zipPath, Map<String, String> checksums) throws Exception {
        try (ZipFile zip = new ZipFile(zipPath.toFile())) {
            ZipEntry manifest = zip.getEntry("manifest.sha256");
            if (manifest == null) throw new SQLException("TENANT_FILE_ARCHIVE_MANIFEST_MISSING");
            for (var expected : checksums.entrySet()) {
                ZipEntry entry = zip.getEntry("files/" + expected.getKey());
                if (entry == null) throw new SQLException("TENANT_FILE_ARCHIVE_ENTRY_MISSING");
                try (InputStream input = zip.getInputStream(entry)) {
                    if (!expected.getValue().equals(sha(input))) throw new SQLException("TENANT_FILE_ARCHIVE_CHECKSUM_MISMATCH");
                }
            }
            if (zip.size() != checksums.size() + 1) throw new SQLException("TENANT_FILE_ARCHIVE_ENTRY_COUNT_MISMATCH");
        }
    }

    private void removeTenantFiles(UUID tenantId) throws Exception {
        for (Path path : tenantStorageRoots(tenantId)) deleteTree(path);
        for (Path path : tenantStorageRoots(tenantId)) {
            if (Files.exists(path, LinkOption.NOFOLLOW_LINKS)) throw new SQLException("TENANT_FILES_STILL_EXIST");
        }
    }

    private void removeTemporaryBackup(UUID tenantId) throws Exception {
        deleteTree(safeTenantPath(storageRoot.resolve(".tenant-purge").resolve(tenantId.toString())));
    }

    private List<Path> tenantStorageRoots(UUID tenantId) {
        String id = tenantId.toString();
        return List.of(storageRoot.resolve(id), storageRoot.resolve("ocr").resolve(id),
                storageRoot.resolve(".backups").resolve(id));
    }

    private boolean safeStorageRelative(String relative, UUID tenantId) {
        Path path = storageRoot.resolve(relative).normalize();
        return path.startsWith(storageRoot.resolve(tenantId.toString()))
                || path.startsWith(storageRoot.resolve("ocr").resolve(tenantId.toString()))
                || path.startsWith(storageRoot.resolve(".backups").resolve(tenantId.toString()));
    }

    private Path safeTenantPath(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        if (!normalized.startsWith(storageRoot)) throw new IllegalArgumentException("Tenant path escapes storage root");
        return normalized;
    }

    private void deleteTree(Path path) throws Exception {
        Path safe = safeTenantPath(path);
        if (!Files.exists(safe, LinkOption.NOFOLLOW_LINKS)) return;
        try (Stream<Path> paths = Files.walk(safe)) {
            for (Path item : paths.sorted(Comparator.reverseOrder()).toList()) {
                Path checked = safeTenantPath(item);
                Files.deleteIfExists(checked);
            }
        }
    }

    private void dropDatabase(Connection controlConnection, UUID tenantId, String name) throws SQLException {
        router.closeTenantPool(tenantId);
        try (Statement statement = controlConnection.createStatement()) {
            statement.execute("DROP DATABASE " + quoteIdentifier(TenantDatabaseName.validate(name)) + " WITH (FORCE)");
        }
    }

    private void markDeleted(UUID tenantId) throws SQLException {
        try (Connection connection = adminConnection(controlUrl)) {
            connection.setAutoCommit(false);
            try (PreparedStatement update = connection.prepareStatement("UPDATE app.tenant_database_registry SET lifecycle_state='DELETED',deleted_at=now(),updated_at=now(),last_error_code=NULL WHERE tenant_id=? AND lifecycle_state IN ('DELETING','DELETION_FAILED')")) {
                update.setObject(1, tenantId); if (update.executeUpdate() != 1) throw new SQLException("TENANT_DELETE_STATE_CHANGED");
            }
            try (PreparedStatement updateTenant = connection.prepareStatement("UPDATE public.tenants SET subscription_status='EXPIRED' WHERE id=?")) {
                updateTenant.setObject(1, tenantId);
                if (updateTenant.executeUpdate() != 1) throw new SQLException("TENANT_METADATA_MISSING_AFTER_DATABASE_DELETION");
            }
            event(connection, tenantId, "DATABASE_DELETED", "{\"databaseAbsent\":true,\"tenantFilesAbsent\":true,\"temporaryBackupRemoved\":true}");
            try (PreparedStatement deleteRoutes = connection.prepareStatement("DELETE FROM app.tenant_payment_routes WHERE tenant_id=? AND consumed_at IS NULL")) {
                deleteRoutes.setObject(1, tenantId); deleteRoutes.executeUpdate();
            }
            connection.commit();
        }
    }

    private void markDeletionFailed(UUID tenantId, String code) {
        try (Connection connection = adminConnection(controlUrl)) {
            connection.setAutoCommit(false);
            try (PreparedStatement update = connection.prepareStatement("UPDATE app.tenant_database_registry SET lifecycle_state='DELETION_FAILED',last_error_code=?,updated_at=now() WHERE tenant_id=? AND lifecycle_state IN ('DELETING','DELETION_FAILED')")) {
                update.setString(1, code); update.setObject(2, tenantId);
                if (update.executeUpdate() == 1) event(connection, tenantId, "DELETION_FAILED", "{\"code\":\"" + code + "\"}");
            }
            connection.commit();
        } catch (Exception ignored) { log.error("Could not persist tenant deletion failure for tenant {}", tenantId); }
    }

    private void recordEvent(UUID tenantId, String type, String details) throws SQLException {
        try (Connection connection = adminConnection(controlUrl)) { event(connection, tenantId, type, details); }
    }

    private void event(Connection connection, UUID tenantId, String type, String details) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement("INSERT INTO app.tenant_lifecycle_events(tenant_id,event_type,details) VALUES(?,?,?::jsonb)")) {
            insert.setObject(1, tenantId); insert.setString(2, type); insert.setString(3, details); insert.executeUpdate();
        }
    }

    private boolean hasLifecycleEvent(UUID tenantId, String type) throws SQLException {
        try (Connection connection = adminConnection(controlUrl); PreparedStatement query = connection.prepareStatement("SELECT EXISTS(SELECT 1 FROM app.tenant_lifecycle_events WHERE tenant_id=? AND event_type=?)")) {
            query.setObject(1, tenantId); query.setString(2, type); try (ResultSet row = query.executeQuery()) { row.next(); return row.getBoolean(1); }
        }
    }

    private long countAudit(Connection connection, UUID tenantId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT count(*) FROM public.audit_events WHERE tenant_id=?")) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { row.next(); return row.getLong(1); }
        }
    }
    private long countArchived(Connection connection, UUID tenantId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT count(*) FROM app.tenant_audit_archive WHERE tenant_id=?")) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { row.next(); return row.getLong(1); }
        }
    }
    private long countAuditedRows(UUID tenantId) throws SQLException {
        try (Connection connection = adminConnection(controlUrl)) { return countArchived(connection, tenantId); }
    }

    private void runClient(List<String> command) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD);
        Map<String, String> env = builder.environment();
        env.put("PGHOST", host); env.put("PGPORT", Integer.toString(port)); env.put("PGUSER", adminUsername); env.put("PGPASSWORD", adminPassword);
        if (sslMode != null) env.put("PGSSLMODE", sslMode);
        Process process = builder.start();
        if (!process.waitFor(Duration.ofMinutes(45).toMillis(), TimeUnit.MILLISECONDS)) {
            process.destroyForcibly(); throw new SQLException("TENANT_BACKUP_OR_RESTORE_LIST_TIMEOUT");
        }
        if (process.exitValue() != 0) throw new SQLException("TENANT_BACKUP_VERIFICATION_FAILED_EXIT_" + process.exitValue());
    }

    private Connection adminConnection(String url) throws SQLException { return DriverManager.getConnection(url, adminUsername, adminPassword); }
    private String databaseUrl(String name) { return controlUrl.replaceFirst("(?<=/)[^/?]+(?=\\?|$)", TenantDatabaseName.validate(name)); }
    private static String quoteIdentifier(String value) {
        if (value == null || !value.matches("[A-Za-z_][A-Za-z0-9_$]{0,62}")) throw new IllegalArgumentException("Invalid SQL identifier");
        return "\"" + value + "\"";
    }
    private static String safeCode(Exception error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && sql.getSQLState() != null) return "SQLSTATE_" + sql.getSQLState();
        }
        String message = error.getMessage(); if (message == null) return "DELETION_ERROR";
        String code = message.split(":", 2)[0].replaceAll("[^A-Za-z0-9_-]", "_");
        return code.length() > 80 ? code.substring(0, 80) : code;
    }
    private static String sha(Path path) throws Exception { try (InputStream input = Files.newInputStream(path)) { return sha(input); } }
    private static String sha(InputStream input) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] buffer = new byte[65536]; int read;
        while ((read = input.read(buffer)) >= 0) digest.update(buffer, 0, read);
        return HexFormat.of().formatHex(digest.digest());
    }
    private void restrict(Path path, boolean directory) {
        try { if (Files.getFileStore(path).supportsFileAttributeView("posix")) Files.setPosixFilePermissions(path,
                PosixFilePermissions.fromString(directory ? "rwx------" : "rw-------")); } catch (Exception ignored) { }
    }

    private record Backup(long auditRows, String databaseSha256, String filesSha256) { }
    private record PgAddress(String host, int port, String sslMode) {
        static PgAddress from(String jdbcUrl) {
            URI uri = URI.create(jdbcUrl.substring("jdbc:".length())); String ssl = null;
            if (uri.getRawQuery() != null) for (String pair : uri.getRawQuery().split("&")) {
                String[] parts = pair.split("=", 2); if (parts.length == 2 && "sslmode".equals(parts[0])) ssl = parts[1];
            }
            return new PgAddress(uri.getHost(), uri.getPort() < 0 ? 5432 : uri.getPort(), ssl);
        }
    }
}
