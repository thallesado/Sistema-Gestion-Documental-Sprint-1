package com.lta.gestdocum.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/** Applies the versioned tenant-safe migration set to already provisioned isolated databases. */
@Service
@Profile("tenant-worker")
public class TenantDatabaseMigrationService {
    private static final Logger log = LoggerFactory.getLogger(TenantDatabaseMigrationService.class);
    private static final Pattern JDBC_URL = Pattern.compile("^(jdbc:postgresql://[^/]+/)[^?]+(\\?.*)?$");
    private static final Set<String> CONTROL_ONLY = Set.of("001", "002", "003", "005", "015", "016", "066", "069");

    private final JdbcTemplate control;
    private final String jdbcUrl;
    private final String adminUsername;
    private final String adminPassword;
    private final Path migrations;
    private final String script;

    public TenantDatabaseMigrationService(
            @Qualifier("controlDataSource") DataSource controlDataSource,
            @Value("${spring.datasource.url}") String jdbcUrl,
            @Value("${app.tenant-databases.admin-username:}") String adminUsername,
            @Value("${app.tenant-databases.admin-password:}") String adminPassword,
            @Value("${app.tenant-databases.bootstrap-script:/app/migrations/tenant-bootstrap/migrate-tenant.sh}") String script,
            @Value("${app.tenant-databases.migrations-dir:/app/migrations/init}") String migrations) {
        this.control = new JdbcTemplate(controlDataSource);
        this.jdbcUrl = jdbcUrl;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.script = script;
        this.migrations = Path.of(migrations);
    }

    @Scheduled(fixedDelayString = "${app.tenant-databases.migration-poll-ms:900000}",
            initialDelayString = "${app.tenant-databases.migration-initial-ms:120000}")
    public void migrateIsolatedDatabases() {
        if (adminUsername.isBlank() || adminPassword.isBlank()) {
            log.error("Tenant schema migration skipped: dedicated database migration credentials are not configured");
            return;
        }
        try {
            List<String> targets = control.query("""
                    SELECT database_name FROM app.tenant_database_registry
                    WHERE storage_mode='ISOLATED' AND lifecycle_state IN ('TRIAL','GRACE_READ_ONLY','ACTIVE')
                      AND database_name IS NOT NULL ORDER BY database_name
                    """, (row, index) -> TenantDatabaseName.validate(row.getString(1)));
            Set<String> required = requiredMigrations();
            for (String database : targets) {
                try {
                    if (!needsMigration(database, required)) continue;
                    runMigration(database);
                    log.info("Tenant schema migration completed for {}", database);
                } catch (Exception failure) {
                    log.error("Tenant schema migration failed for {} ({})", database,
                            failure.getClass().getSimpleName());
                }
            }
        } catch (Exception failure) {
            log.error("Tenant schema migration scan failed ({})", failure.getClass().getSimpleName());
        }
    }

    private Set<String> requiredMigrations() throws Exception {
        try (var files = Files.list(migrations)) {
            return files.filter(Files::isRegularFile).map(path -> path.getFileName().toString())
                    .filter(name -> name.matches("[0-9]{3}_[a-zA-Z0-9_]+\\.sql"))
                    .filter(name -> !CONTROL_ONLY.contains(name.substring(0, 3)))
                    .filter(name -> !name.startsWith("059_tenant_database_lifecycle"))
                    .filter(name -> !name.startsWith("005_demo_users") && !name.startsWith("015_acme_superadmin_demo_users"))
                    .map(name -> name.substring(0, name.length() - 4)).collect(java.util.stream.Collectors.toSet());
        }
    }

    private boolean needsMigration(String database, Set<String> required) throws Exception {
        String url = databaseUrl(database);
        try (var connection = DriverManager.getConnection(url, adminUsername, adminPassword);
             var statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT version FROM app.schema_migrations")) {
            Set<String> applied = new HashSet<>();
            while (rows.next()) applied.add(rows.getString(1));
            return !applied.containsAll(required);
        }
    }

    private void runMigration(String database) throws Exception {
        ProcessBuilder builder = new ProcessBuilder("/bin/sh", script).redirectErrorStream(true)
                .redirectOutput(ProcessBuilder.Redirect.DISCARD);
        Map<String, String> env = builder.environment();
        env.put("PGHOST", jdbcHost());
        env.put("PGPORT", jdbcPort());
        env.put("PGDATABASE", database);
        env.put("PGUSER", adminUsername);
        env.put("PGPASSWORD", adminPassword);
        env.put("MIGRATIONS_ROOT", "/app/migrations");
        var process = builder.start();
        try {
            if (!process.waitFor(15, TimeUnit.MINUTES)) {
                process.destroyForcibly();
                throw new IllegalStateException("TENANT_MIGRATION_TIMEOUT");
            }
            if (process.exitValue() != 0) throw new IllegalStateException("TENANT_MIGRATION_FAILED");
        } finally {
            process.destroy();
        }
    }

    private String databaseUrl(String database) {
        var matcher = JDBC_URL.matcher(jdbcUrl);
        if (!matcher.matches()) throw new IllegalStateException("TENANT_DATABASE_JDBC_URL_INVALID");
        return matcher.group(1) + database + (matcher.group(2) == null ? "" : matcher.group(2));
    }

    private String jdbcHost() {
        var matcher = Pattern.compile("^jdbc:postgresql://([^/:?]+)(?::([0-9]+))?/.*$").matcher(jdbcUrl);
        if (!matcher.matches()) throw new IllegalStateException("TENANT_DATABASE_JDBC_URL_INVALID");
        return matcher.group(1);
    }

    private String jdbcPort() {
        var matcher = Pattern.compile("^jdbc:postgresql://[^/:?]+(?::([0-9]+))?/.*$").matcher(jdbcUrl);
        if (!matcher.matches()) throw new IllegalStateException("TENANT_DATABASE_JDBC_URL_INVALID");
        return matcher.group(1) == null ? "5432" : matcher.group(1);
    }
}
