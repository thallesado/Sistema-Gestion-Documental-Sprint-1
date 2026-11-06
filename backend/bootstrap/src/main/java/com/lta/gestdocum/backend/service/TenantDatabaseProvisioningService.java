package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;

import java.net.URI;
import java.sql.*;
import java.time.Duration;
import java.util.*;

/** Creates a tenant database, bootstraps it, transfers its initial tenant data and switches routing. */
@Service
@Profile("tenant-worker")
@ConditionalOnProperty(name = "app.tenant-databases.provisioning-enabled", havingValue = "true")
public class TenantDatabaseProvisioningService {
    private static final Logger log = LoggerFactory.getLogger(TenantDatabaseProvisioningService.class);
    private static final List<String> GLOBAL_TABLES = List.of("plans", "plan_limits", "plan_features", "permissions");

    private final String controlUrl;
    private final String runtimeUsername;
    private final String runtimePassword;
    private final String adminUsername;
    private final String adminPassword;
    private final String bootstrapScript;
    private final PgAddress pgAddress;

    public TenantDatabaseProvisioningService(
            DataSourceProperties dataSource,
            @Value("${app.tenant-databases.admin-username:}") String adminUsername,
            @Value("${app.tenant-databases.admin-password:}") String adminPassword,
            @Value("${app.tenant-databases.bootstrap-script:/app/migrations/tenant-bootstrap/migrate-tenant.sh}") String bootstrapScript,
            @Value("${app.tenant-databases.provisioning-enabled:false}") boolean enabled,
            @Value("${app.tenant-databases.routing-enabled:false}") boolean routingEnabled) {
        this.controlUrl = Objects.requireNonNull(dataSource.determineUrl(), "spring.datasource.url");
        this.runtimeUsername = Objects.requireNonNull(dataSource.determineUsername(), "spring.datasource.username");
        this.runtimePassword = Objects.requireNonNull(dataSource.determinePassword(), "spring.datasource.password");
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.bootstrapScript = bootstrapScript;
        this.pgAddress = PgAddress.from(controlUrl);
        if (enabled && adminUsername.isBlank()) {
            throw new IllegalStateException("El aprovisionamiento requiere credenciales administrativas PostgreSQL configuradas fuera del código.");
        }
        if (enabled && !routingEnabled) {
            throw new IllegalStateException("No se puede aprovisionar sin habilitar el enrutamiento de bases por tenant.");
        }
        if (enabled && adminUsername.equals(runtimeUsername)) {
            throw new IllegalStateException("La credencial de provisión debe ser distinta de la credencial de runtime.");
        }
    }

    /** Called only after the transaction that creates the tenant and its first administrator commits. */
    public void provision(UUID tenantId) {
        String dbName = TenantDatabaseName.forTenant(tenantId);
        try (Connection lockConnection = adminConnection(controlUrl)) {
            if (!tryProvisionLock(lockConnection, tenantId)) return;
            if (!beginProvisioning(tenantId, dbName)) return;
            ensureDatabase(dbName);
            ensureSchema(dbName);
            verifyRuntimeRole(dbName);
            transferAndSwitch(tenantId, dbName);
            log.info("Tenant database provisioning completed for tenant {}", tenantId);
        } catch (Exception error) {
            String code = safeCode(error);
            markFailed(tenantId, code);
            log.error("Tenant database provisioning failed for tenant {} ({})", tenantId,
                    code);
        }
    }

    private boolean tryProvisionLock(Connection connection, UUID tenantId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT pg_try_advisory_lock(726397,hashtext(?))")) {
            query.setString(1, tenantId.toString());
            try (ResultSet row = query.executeQuery()) { return row.next() && row.getBoolean(1); }
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    @Scheduled(fixedDelayString = "${app.tenant-databases.retry-ms:30000}", initialDelayString = "${app.tenant-databases.retry-initial-ms:5000}")
    public void retryFailedProvisioning() {
        List<UUID> pending;
        try (TenantDatabaseContext.Scope ignored = TenantDatabaseContext.useControl();
             Connection connection = DriverManager.getConnection(controlUrl, adminUsername, adminPassword);
             PreparedStatement statement = connection.prepareStatement("SELECT tenant_id FROM app.tenant_database_registry WHERE storage_mode='ISOLATED' AND lifecycle_state IN ('PROVISIONING','PROVISIONING_FAILED') AND last_error_code IS DISTINCT FROM 'TENANT_AUDIT_CHAIN_INVALID' ORDER BY tenant_id LIMIT 20");
             ResultSet rows = statement.executeQuery()) {
            pending = new ArrayList<>();
            while (rows.next()) pending.add(rows.getObject(1, UUID.class));
        } catch (Exception error) {
            // Migration 059 or the admin connection may not exist during early startup.
            log.debug("Tenant provisioning retry scan is not available yet ({})", error.getClass().getSimpleName());
            return;
        }
        pending.forEach(this::provision);
    }

    private boolean beginProvisioning(UUID tenantId, String dbName) throws SQLException {
        try (Connection connection = adminConnection(controlUrl)) {
            connection.setAutoCommit(false);
            try (PreparedStatement query = connection.prepareStatement("SELECT storage_mode,lifecycle_state FROM app.tenant_database_registry WHERE tenant_id=? FOR UPDATE")) {
                query.setObject(1, tenantId);
                try (ResultSet row = query.executeQuery()) {
                    if (!row.next()) throw new SQLException("TENANT_REGISTRY_MISSING");
                    String mode = row.getString(1), state = row.getString(2);
                    if ("ISOLATED".equals(mode) && ("TRIAL".equals(state) || "ACTIVE".equals(state))) {
                        connection.rollback();
                        return false;
                    }
                    if (!("LEGACY_SHARED".equals(mode) || ("ISOLATED".equals(mode)
                            && ("PROVISIONING".equals(state) || "PROVISIONING_FAILED".equals(state))))) {
                        throw new SQLException("TENANT_STATE_NOT_PROVISIONABLE");
                    }
                }
            }
            try (PreparedStatement update = connection.prepareStatement("UPDATE app.tenant_database_registry SET storage_mode='ISOLATED',database_name=?,lifecycle_state='PROVISIONING',last_error_code=NULL,updated_at=now() WHERE tenant_id=?")) {
                update.setString(1, dbName); update.setObject(2, tenantId); update.executeUpdate();
            }
            event(connection, tenantId, "DATABASE_PROVISIONING_STARTED", "{}");
            connection.commit();
            return true;
        }
    }

    private void ensureDatabase(String dbName) throws SQLException {
        try (Connection connection = adminConnection(controlUrl);
             PreparedStatement query = connection.prepareStatement("SELECT 1 FROM pg_database WHERE datname=?")) {
            query.setString(1, dbName);
            try (ResultSet row = query.executeQuery()) { if (row.next()) return; }
        }
        // The provisioner owns the database so the same restricted administrative role
        // can later drop it; the runtime login receives access through nexodocs_app.
        String owner = quoteIdentifier(adminUsername);
        try (Connection connection = adminConnection(controlUrl); Statement statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE " + quoteIdentifier(TenantDatabaseName.validate(dbName)) + " OWNER " + owner);
        }
    }

    private void ensureSchema(String dbName) throws Exception {
        ProcessBuilder builder = new ProcessBuilder("/bin/sh", bootstrapScript)
                .redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD);
        Map<String, String> env = builder.environment();
        env.put("PGHOST", pgAddress.host()); env.put("PGPORT", Integer.toString(pgAddress.port()));
        env.put("PGDATABASE", dbName); env.put("PGUSER", adminUsername); env.put("PGPASSWORD", adminPassword);
        env.put("MIGRATIONS_ROOT", "/app/migrations");
        if (pgAddress.sslMode() != null) env.put("PGSSLMODE", pgAddress.sslMode());
        Process process = builder.redirectErrorStream(true).start();
        if (!process.waitFor(Duration.ofMinutes(15).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS)) {
            process.destroyForcibly(); throw new SQLException("TENANT_BOOTSTRAP_TIMEOUT");
        }
        if (process.exitValue() != 0) {
            throw new SQLException("TENANT_BOOTSTRAP_FAILED_EXIT_" + process.exitValue());
        }
    }

    private void verifyRuntimeRole(String dbName) throws SQLException {
        try (Connection connection = adminConnection(controlUrl); PreparedStatement statement = connection.prepareStatement(
                "SELECT r.rolsuper,r.rolcanlogin,r.rolbypassrls,pg_has_role(r.rolname,'nexodocs_app','member') FROM pg_roles r WHERE r.rolname=?")) {
            statement.setString(1, runtimeUsername);
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next() || row.getBoolean(1) || !row.getBoolean(2) || row.getBoolean(3) || !row.getBoolean(4)) {
                    throw new SQLException("RUNTIME_ROLE_MUST_LOGIN_WITHOUT_SUPERUSER_OR_BYPASSRLS_AND_MEMBER_OF_NEXODOCS_APP");
                }
            }
        }
        try (Connection connection = adminConnection(controlUrl); PreparedStatement statement = connection.prepareStatement(
                "SELECT has_database_privilege(?,?,'CONNECT')")) {
            statement.setString(1, runtimeUsername); statement.setString(2, dbName);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next() || !result.getBoolean(1)) throw new SQLException("RUNTIME_ROLE_CANNOT_CONNECT_TO_TENANT_DATABASE");
            }
        }
        verifyRuntimeDatabaseAccess(dbName);
    }

    private void verifyRuntimeDatabaseAccess(String dbName) throws SQLException {
        try (Connection connection = DriverManager.getConnection(databaseUrl(dbName), runtimeUsername, runtimePassword)) {
            connection.setAutoCommit(false);
            try {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("SET LOCAL ROLE nexodocs_app");
                }
                try (Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery("""
                        SELECT current_user = 'nexodocs_app'
                           AND has_schema_privilege(current_user, 'public', 'USAGE')
                           AND has_schema_privilege(current_user, 'app', 'USAGE')
                           AND has_function_privilege(current_user, 'app.lookup_tenant_login(uuid,text)', 'EXECUTE')
                           AND has_function_privilege(current_user, 'app.has_permission(text)', 'EXECUTE')
                           AND has_column_privilege(current_user, 'public.users', 'id', 'SELECT')
                           AND has_table_privilege(current_user, 'public.user_roles', 'SELECT')
                           AND has_table_privilege(current_user, 'public.role_permissions', 'SELECT')
                           AND has_table_privilege(current_user, 'public.document_types', 'SELECT')
                           AND has_table_privilege(current_user, 'public.auth_sessions', 'INSERT')
                        """)) {
                    if (!result.next() || !result.getBoolean(1)) {
                        throw new SQLException("RUNTIME_ROLE_TENANT_DATABASE_PRIVILEGES_INCOMPLETE");
                    }
                }
            } finally {
                connection.rollback();
            }
        }
    }

    private void transferAndSwitch(UUID tenantId, String dbName) throws SQLException {
        // Target is private while registry is PROVISIONING. Rebuild only this tenant's rows from
        // the still-authoritative control database, allowing a failed transfer to be retried.
        try (Connection source = adminConnection(controlUrl); Connection target = adminConnection(databaseUrl(dbName))) {
            source.setAutoCommit(false); source.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            target.setAutoCommit(false);
            try {
                verifyAuditChain(source, tenantId);
                target.createStatement().execute("SET session_replication_role=replica");
                clearTargetTenant(target, tenantId);
                synchronizeGlobalCatalogs(source, target);
                copyByKey(source, target, "tenants", "id", tenantId);
                List<String> ownedTables = tenantTables(source);
                Map<String, Long> expected = new LinkedHashMap<>();
                for (String table : ownedTables) {
                    expected.put(table, countTenantRows(source, table, tenantId));
                    try {
                        copyByKey(source, target, table, "tenant_id", tenantId);
                    } catch (SQLException failure) {
                        log.error("Tenant data transfer failed for tenant {} while copying table {} (SQLSTATE {})",
                                tenantId, table, failure.getSQLState());
                        throw failure;
                    }
                }
                synchronizeSequences(target);
                verifyTransferredCounts(target, tenantId, expected);
                target.commit();
            } catch (Exception failure) {
                target.rollback(); source.rollback();
                if (failure instanceof SQLException sql) throw sql;
                throw new SQLException("TENANT_DATA_TRANSFER_FAILED", failure);
            }

            try {
                source.setAutoCommit(false);
                source.createStatement().execute("SET session_replication_role=replica");
                archiveAudit(source, tenantId);
                for (String table : tenantTables(source)) {
                    try (PreparedStatement delete = source.prepareStatement("DELETE FROM public." + quoteIdentifier(table) + " WHERE tenant_id=?")) {
                        delete.setObject(1, tenantId); delete.executeUpdate();
                    }
                }
                String finalState = tenantPaid(source, tenantId) ? "ACTIVE" : "TRIAL";
                try (PreparedStatement update = source.prepareStatement("UPDATE app.tenant_database_registry SET lifecycle_state=?,updated_at=now() WHERE tenant_id=? AND lifecycle_state='PROVISIONING'")) {
                    update.setString(1, finalState); update.setObject(2, tenantId);
                    if (update.executeUpdate() != 1) throw new SQLException("TENANT_STATE_CHANGED_DURING_TRANSFER");
                }
                event(source, tenantId, "DATABASE_PROVISIONED", "{\"dataTransferred\":true,\"sourceTenantRowsRemoved\":true}");
                if ("ACTIVE".equals(finalState)) {
                    event(source, tenantId, "PAYMENT_ACTIVATED", "{\"duringProvisioning\":true}");
                }
                source.commit();
            } catch (Exception failure) {
                source.rollback();
                if (failure instanceof SQLException sql) throw sql;
                throw new SQLException("TENANT_SOURCE_CLEANUP_FAILED", failure);
            }
        }
    }

    private void clearTargetTenant(Connection target, UUID tenantId) throws SQLException {
        for (String table : tenantTables(target)) {
            try (PreparedStatement delete = target.prepareStatement("DELETE FROM public." + quoteIdentifier(table) + " WHERE tenant_id=?")) {
                delete.setObject(1, tenantId); delete.executeUpdate();
            }
        }
        try (PreparedStatement delete = target.prepareStatement("DELETE FROM public.tenants WHERE id=?")) {
            delete.setObject(1, tenantId); delete.executeUpdate();
        }
    }

    private void synchronizeGlobalCatalogs(Connection source, Connection target) throws SQLException {
        for (String table : List.of("role_permissions", "permissions", "plan_features", "plan_limits", "plans")) {
            target.createStatement().execute("DELETE FROM public." + quoteIdentifier(table));
        }
        for (String table : GLOBAL_TABLES) {
            try {
                copyWholeTable(source, target, table);
            } catch (SQLException failure) {
                log.error("Tenant global catalog transfer failed for table {} (SQLSTATE {})", table, failure.getSQLState());
                throw failure;
            }
        }
    }

    private List<String> tenantTables(Connection connection) throws SQLException {
        List<String> tables = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' ORDER BY table_name");
             ResultSet rows = query.executeQuery()) {
            while (rows.next()) tables.add(rows.getString(1));
        }
        tables.remove("tenants");
        // Checkout/onboarding state is control-plane billing data and remains in
        // the shared database even when the tenant's operational data is isolated.
        tables.remove("tenant_signups");
        return tables;
    }

    private void copyByKey(Connection source, Connection target, String table, String key, UUID value) throws SQLException {
        List<String> columns = columns(source, table);
        String selectSql = "SELECT " + columnList(columns) + " FROM public." + quoteIdentifier(table) + " WHERE " + quoteIdentifier(key) + "=?";
        String insertSql = insertSql(target, table, columns);
        try (PreparedStatement select = source.prepareStatement(selectSql); PreparedStatement insert = target.prepareStatement(insertSql)) {
            select.setObject(1, value);
            try (ResultSet rows = select.executeQuery()) {
                while (rows.next()) {
                    for (int index = 0; index < columns.size(); index++) insert.setObject(index + 1, rows.getObject(index + 1));
                    insert.executeUpdate();
                }
            }
        }
    }

    private void copyWholeTable(Connection source, Connection target, String table) throws SQLException {
        List<String> columns = columns(source, table);
        String selectSql = "SELECT " + columnList(columns) + " FROM public." + quoteIdentifier(table);
        String insertSql = insertSql(target, table, columns);
        try (Statement select = source.createStatement(); ResultSet rows = select.executeQuery(selectSql);
             PreparedStatement insert = target.prepareStatement(insertSql)) {
            while (rows.next()) {
                for (int index = 0; index < columns.size(); index++) {
                    Object value = rows.getObject(index + 1);
                    // Historical shared databases may contain NULL criticality values,
                    // while a freshly bootstrapped tenant schema requires the default.
                    if ("permissions".equals(table) && "criticality".equals(columns.get(index)) && value == null) {
                        value = "MEDIUM";
                    }
                    insert.setObject(index + 1, value);
                }
                insert.executeUpdate();
            }
        }
    }

    private String insertSql(Connection target, String table, List<String> columns) throws SQLException {
        String overrideIdentity = "";
        Map<String, String> enumTypes = new HashMap<>();
        try (PreparedStatement query = target.prepareStatement("SELECT column_name,data_type,udt_name,is_identity,identity_generation FROM information_schema.columns WHERE table_schema='public' AND table_name=? ORDER BY ordinal_position")) {
            query.setString(1, table);
            try (ResultSet row = query.executeQuery()) {
                while (row.next()) {
                    if ("YES".equals(row.getString("is_identity")) && "ALWAYS".equals(row.getString("identity_generation"))) {
                        overrideIdentity = " OVERRIDING SYSTEM VALUE";
                    }
                    if ("USER-DEFINED".equals(row.getString("data_type"))) {
                        enumTypes.put(row.getString("column_name"), row.getString("udt_name"));
                    }
                }
            }
        }
        String values = columns.stream().map(column -> enumTypes.containsKey(column)
                ? "?::public." + quoteIdentifier(enumTypes.get(column)) : "?")
                .reduce((left, right) -> left + "," + right).orElseThrow();
        return "INSERT INTO public." + quoteIdentifier(table) + " (" + columnList(columns) + ")" + overrideIdentity
                + " VALUES (" + values + ")";
    }

    private List<String> columns(Connection connection, String table) throws SQLException {
        List<String> result = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=? ORDER BY ordinal_position")) {
            query.setString(1, table);
            try (ResultSet rows = query.executeQuery()) { while (rows.next()) result.add(rows.getString(1)); }
        }
        if (result.isEmpty()) throw new SQLException("TENANT_TRANSFER_TABLE_MISSING_" + table);
        return result;
    }

    private long countTenantRows(Connection connection, String table, UUID tenantId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT count(*) FROM public." + quoteIdentifier(table) + " WHERE tenant_id=?")) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { row.next(); return row.getLong(1); }
        }
    }

    private void verifyTransferredCounts(Connection target, UUID tenantId, Map<String, Long> expected) throws SQLException {
        for (var entry : expected.entrySet()) {
            long actual = countTenantRows(target, entry.getKey(), tenantId);
            if (actual != entry.getValue()) throw new SQLException("TENANT_TRANSFER_COUNT_MISMATCH_" + entry.getKey());
        }
        try (PreparedStatement query = target.prepareStatement("SELECT count(*) FROM public.tenants WHERE id=?")) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) {
                if (!row.next() || row.getLong(1) != 1) throw new SQLException("TENANT_TRANSFER_ROOT_MISSING");
            }
        }
    }

    private void archiveAudit(Connection source, UUID tenantId) throws SQLException {
        String sql = "INSERT INTO app.tenant_audit_archive(tenant_id,source_event_id,user_id,platform_actor_id,action,entity_type,entity_id,occurred_at,client_timestamp,client_timezone,ip_address,user_agent,result,details,chain_seq,previous_hash,record_hash) " +
                "SELECT tenant_id,id,user_id,platform_actor_id,action,entity_type,entity_id,occurred_at,client_timestamp,client_timezone,ip_address,user_agent,result,details,chain_seq,previous_hash,record_hash FROM public.audit_events WHERE tenant_id=? ON CONFLICT(tenant_id,source_event_id) DO NOTHING";
        try (PreparedStatement statement = source.prepareStatement(sql)) { statement.setObject(1, tenantId); statement.executeUpdate(); }
        try (PreparedStatement query = source.prepareStatement("SELECT (SELECT count(*) FROM public.audit_events WHERE tenant_id=?),(SELECT count(*) FROM app.tenant_audit_archive WHERE tenant_id=?)")) {
            query.setObject(1, tenantId); query.setObject(2, tenantId);
            try (ResultSet row = query.executeQuery()) {
                if (!row.next() || row.getLong(1) != row.getLong(2)) throw new SQLException("TENANT_AUDIT_ARCHIVE_COUNT_MISMATCH");
            }
        }
    }

    private void verifyAuditChain(Connection source, UUID tenantId) throws SQLException {
        String sql = "WITH chain AS (SELECT chain_seq,previous_hash,record_hash, " +
                "row_number() OVER (ORDER BY chain_seq) AS expected_seq, " +
                "lag(record_hash,1,'0000000000000000000000000000000000000000000000000000000000000000') OVER (ORDER BY chain_seq) AS expected_previous, " +
                "encode(digest(app.canonical_audit_payload(chain_seq,previous_hash,tenant_id,user_id,action,entity_type,entity_id,occurred_at,result,ip_address,details),'sha256'),'hex') AS expected_record " +
                "FROM public.audit_events WHERE tenant_id=?) " +
                "SELECT count(*) FROM chain WHERE chain_seq IS NULL OR previous_hash IS NULL OR record_hash IS NULL OR chain_seq<>expected_seq OR trim(previous_hash)<>expected_previous OR trim(record_hash)<>expected_record";
        try (PreparedStatement query = source.prepareStatement(sql)) {
            query.setObject(1, tenantId);
            try (ResultSet row = query.executeQuery()) {
                if (!row.next() || row.getLong(1) != 0) throw new SQLException("TENANT_AUDIT_CHAIN_INVALID");
            }
        }
        try (PreparedStatement query = source.prepareStatement("SELECT count(*) FROM public.audit_anchors a LEFT JOIN public.audit_events e ON e.tenant_id=a.tenant_id AND e.chain_seq=a.chain_seq WHERE a.tenant_id=? AND (e.id IS NULL OR trim(e.record_hash)<>trim(a.record_hash))")) {
            query.setObject(1, tenantId);
            try (ResultSet row = query.executeQuery()) {
                if (!row.next() || row.getLong(1) != 0) throw new SQLException("TENANT_AUDIT_ANCHOR_INVALID");
            }
        }
    }

    private boolean tenantPaid(Connection source, UUID tenantId) throws SQLException {
        try (PreparedStatement query = source.prepareStatement("SELECT subscription_status='ACTIVE' FROM public.tenants WHERE id=?")) {
            query.setObject(1, tenantId); try (ResultSet row = query.executeQuery()) { return row.next() && row.getBoolean(1); }
        }
    }

    private void synchronizeSequences(Connection target) throws SQLException {
        List<String[]> sequenceColumns = new ArrayList<>();
        try (PreparedStatement query = target.prepareStatement("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_default LIKE 'nextval(%' ORDER BY table_name,column_name"); ResultSet rows = query.executeQuery()) {
            while (rows.next()) sequenceColumns.add(new String[]{rows.getString(1), rows.getString(2)});
        }
        for (String[] item : sequenceColumns) {
            String table = quoteIdentifier(item[0]), column = quoteIdentifier(item[1]);
            String sql = "SELECT setval(pg_get_serial_sequence('public." + item[0].replace("'", "''") + "','" + item[1].replace("'", "''") + "'), COALESCE(MAX(" + column + "),1), MAX(" + column + ") IS NOT NULL) FROM public." + table;
            target.createStatement().executeQuery(sql).close();
        }
    }

    private void event(Connection connection, UUID tenantId, String type, String details) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("INSERT INTO app.tenant_lifecycle_events(tenant_id,event_type,details) VALUES(?,?,?::jsonb)")) {
            statement.setObject(1, tenantId); statement.setString(2, type); statement.setString(3, details); statement.executeUpdate();
        }
    }

    private void markFailed(UUID tenantId, String code) {
        try (Connection connection = adminConnection(controlUrl)) {
            connection.setAutoCommit(false);
            try (PreparedStatement update = connection.prepareStatement("UPDATE app.tenant_database_registry SET lifecycle_state='PROVISIONING_FAILED',last_error_code=?,updated_at=now() WHERE tenant_id=? AND lifecycle_state='PROVISIONING'")) {
                update.setString(1, code); update.setObject(2, tenantId);
                if (update.executeUpdate() == 1) event(connection, tenantId, "PROVISIONING_FAILED", "{\"code\":\"" + code + "\"}");
            }
            connection.commit();
        } catch (Exception ignored) {
            log.error("Could not persist tenant provisioning failure for tenant {}", tenantId);
        }
    }

    private Connection adminConnection(String url) throws SQLException {
        return DriverManager.getConnection(url, adminUsername, adminPassword);
    }

    private String databaseUrl(String name) {
        return controlUrl.replaceFirst("(?<=/)[^/?]+(?=\\?|$)", TenantDatabaseName.validate(name));
    }

    private static String quoteIdentifier(String value) {
        if (value == null || !value.matches("[A-Za-z_][A-Za-z0-9_$]{0,62}")) throw new IllegalArgumentException("Invalid SQL identifier");
        return "\"" + value + "\"";
    }
    private static String columnList(List<String> columns) { return columns.stream().map(TenantDatabaseProvisioningService::quoteIdentifier).reduce((a,b)->a+","+b).orElseThrow(); }
    private static String safeCode(Exception error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && sql.getSQLState() != null) {
                return "SQLSTATE_" + sql.getSQLState();
            }
        }
        String message = error.getMessage();
        if (message == null) return "PROVISIONING_ERROR";
        String first = message.split(":", 2)[0].replaceAll("[^A-Za-z0-9_-]", "_");
        return first.length() > 80 ? first.substring(0, 80) : first;
    }

    private record PgAddress(String host, int port, String sslMode) {
        static PgAddress from(String jdbcUrl) {
            try {
                URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
                String ssl = null;
                String query = uri.getRawQuery();
                if (query != null) for (String pair : query.split("&")) {
                    String[] parts = pair.split("=", 2);
                    if (parts.length == 2 && "sslmode".equals(parts[0])) ssl = parts[1];
                }
                return new PgAddress(uri.getHost(), uri.getPort() < 0 ? 5432 : uri.getPort(), ssl);
            } catch (Exception error) {
                throw new IllegalArgumentException("La URL JDBC debe ser PostgreSQL con host y puerto válidos.", error);
            }
        }
    }
}
