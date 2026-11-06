package com.lta.gestdocum.backend.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

/** Enabled only after the central registry migration and tenant bootstrap are available. */
@Configuration
@ConditionalOnProperty(name = "app.tenant-databases.routing-enabled", havingValue = "true")
@EnableConfigurationProperties(DataSourceProperties.class)
public class TenantDatabaseRoutingConfiguration {
    @Bean(name = "controlDataSource", destroyMethod = "close")
    @ConfigurationProperties("spring.datasource.hikari")
    HikariDataSource controlDataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().type(HikariDataSource.class).build();
    }

    @Bean(destroyMethod = "close")
    @Primary
    DataSource tenantRoutingDataSource(DataSourceProperties properties,
                                      @org.springframework.beans.factory.annotation.Qualifier("controlDataSource") DataSource control) {
        return new TenantDatabaseRoutingDataSource(control, properties.determineUrl(), properties.determineUsername(),
                properties.determinePassword(), true);
    }
}
