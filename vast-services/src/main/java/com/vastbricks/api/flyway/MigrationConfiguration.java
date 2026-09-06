package com.vastbricks.api.flyway;

import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.orm.jpa.EntityManagerFactoryDependsOnPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class MigrationConfiguration {

    @Bean(initMethod = "migrate")
    VastDatabaseMigration vastDatabaseMigration(DataSource dataSource, FlywaySettings settings) {
        return new VastDatabaseMigration(dataSource, settings);
    }

    /**
     * Makes the JPA entity manager wait for the migrations, the way Spring Boot's own Flyway auto-configuration does.
     *
     * <p>Without it the order is emergent: a bean whose constructor reads a database-backed setting can be built
     * before the schema those settings live in exists, and whether it is depends on the shape of the bean graph
     * rather than on anything stated. The per-repository {@code @DependsOn} does not cover it, because the entity
     * manager the repository is built on is what needs to come second.
     */
    @Bean
    static EntityManagerFactoryDependsOnPostProcessor vastMigrationEntityManagerFactoryDependsOnPostProcessor() {
        return new EntityManagerFactoryDependsOnPostProcessor("vastDatabaseMigration") {
        };
    }
}
