package com.lta.gestdocum.worker;

import com.lta.gestdocum.backend.config.TenantDatabaseRoutingDataSource;
import com.lta.gestdocum.backend.service.TenantDatabaseDeletionService;
import com.lta.gestdocum.backend.service.TenantDatabaseLifecycleService;
import com.lta.gestdocum.backend.service.TenantDatabaseProvisioningService;
import com.lta.gestdocum.backend.service.TenantDatabaseMigrationService;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableScheduling;

import javax.sql.DataSource;

/** Minimal non-HTTP context for privileged tenant database lifecycle operations. */
@Configuration(proxyBeanMethods = false)
@EnableAutoConfiguration(exclude = {DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class,
        JpaRepositoriesAutoConfiguration.class, SecurityAutoConfiguration.class,
        SecurityFilterAutoConfiguration.class, WebMvcAutoConfiguration.class})
@EnableConfigurationProperties(DataSourceProperties.class)
@EnableScheduling
@Profile("tenant-worker")
@Import({TenantDatabaseProvisioningService.class, TenantDatabaseMigrationService.class, TenantDatabaseLifecycleService.class,
        TenantDatabaseDeletionService.class})
public class TenantLifecycleWorkerConfiguration {
    @Bean(name = "controlDataSource", destroyMethod = "close")
    HikariDataSource controlDataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }

    @Bean(destroyMethod = "close")
    TenantDatabaseRoutingDataSource tenantDatabaseRouter(
            @Qualifier("controlDataSource") DataSource controlDataSource,
            DataSourceProperties properties,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password:}") String password) {
        return new TenantDatabaseRoutingDataSource(controlDataSource, properties.determineUrl(), username, password, true);
    }
}
