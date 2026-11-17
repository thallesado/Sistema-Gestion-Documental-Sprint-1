package com.lta.gestdocum.backend.config;

import com.lta.gestdocum.backend.security.TenantDatabaseContext;
import com.lta.gestdocum.backend.service.TenantDatabaseName;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.jdbc.datasource.AbstractDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.SQLNonTransientConnectionException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/** Routes authenticated tenant connections to their registered database; all other calls use control DB. */
public final class TenantDatabaseRoutingDataSource extends AbstractDataSource implements AutoCloseable {
    private final DataSource controlDataSource;
    private final String baseJdbcUrl;
    private final String username;
    private final String password;
    private final boolean enabled;
    private final Map<String, HikariDataSource> tenantPools = new ConcurrentHashMap<>();

    public TenantDatabaseRoutingDataSource(DataSource controlDataSource, String baseJdbcUrl,
                                           String username, String password, boolean enabled) {
        this.controlDataSource = controlDataSource;
        this.baseJdbcUrl = baseJdbcUrl;
        this.username = username;
        this.password = password;
        this.enabled = enabled;
    }

    @Override
    public Connection getConnection() throws SQLException {
        return resolve().getConnection();
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        return resolve().getConnection(username, password);
    }

    private DataSource resolve() throws SQLException {
        TenantDatabaseContext.Route route = TenantDatabaseContext.current();
        if (!enabled || route == null || route.tenantId() == null) return controlDataSource;
        String databaseName = route.databaseNameOverride();
        if (databaseName == null) databaseName = lookupDatabase(route.tenantId());
        if (databaseName == null) return controlDataSource;
        String validated = TenantDatabaseName.validate(databaseName);
        return tenantPools.computeIfAbsent(validated, this::newPool);
    }

    private String lookupDatabase(UUID tenantId) throws SQLException {
        try (Connection connection = controlDataSource.getConnection();
             var statement = connection.prepareStatement("""
                 SELECT storage_mode, database_name, lifecycle_state
                 FROM app.tenant_database_registry WHERE tenant_id = ?
                 """)) {
            statement.setObject(1, tenantId);
            try (var rows = statement.executeQuery()) {
                if (!rows.next() || "LEGACY_SHARED".equals(rows.getString("storage_mode"))) return null;
                String state = rows.getString("lifecycle_state");
                if (!"TRIAL".equals(state) && !"GRACE_READ_ONLY".equals(state) && !"ACTIVE".equals(state)) {
                    throw new SQLNonTransientConnectionException("La base de datos del tenant no está disponible.");
                }
                return rows.getString("database_name");
            }
        }
    }

    private HikariDataSource newPool(String databaseName) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(databaseUrl(databaseName));
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(3);
        config.setMinimumIdle(0);
        config.setPoolName("tenant-" + databaseName.substring(databaseName.length() - 8));
        return new HikariDataSource(config);
    }

    /** Closes one tenant pool before the lifecycle worker drops its PostgreSQL database. */
    public void closeTenantPool(UUID tenantId) {
        String databaseName = TenantDatabaseName.forTenant(tenantId);
        HikariDataSource pool = tenantPools.remove(databaseName);
        if (pool != null) pool.close();
    }

    private String databaseUrl(String databaseName) {
        int queryIndex = baseJdbcUrl.indexOf('?');
        String pathAndQuery = queryIndex < 0 ? baseJdbcUrl : baseJdbcUrl.substring(0, queryIndex);
        String query = queryIndex < 0 ? "" : baseJdbcUrl.substring(queryIndex);
        int slash = pathAndQuery.lastIndexOf('/');
        if (!baseJdbcUrl.startsWith("jdbc:postgresql://") || slash < "jdbc:postgresql://".length()) {
            throw new IllegalStateException("La URL JDBC de PostgreSQL no tiene el formato esperado.");
        }
        return pathAndQuery.substring(0, slash + 1) + databaseName + query;
    }

    @Override public void setLoginTimeout(int seconds) throws SQLException { DriverManager.setLoginTimeout(seconds); }
    @Override public int getLoginTimeout() { return DriverManager.getLoginTimeout(); }
    @Override public Logger getParentLogger() { return Logger.getLogger("com.lta.gestdocum.tenant-datasource"); }

    @Override
    public void close() {
        tenantPools.values().forEach(HikariDataSource::close);
        tenantPools.clear();
    }
}
