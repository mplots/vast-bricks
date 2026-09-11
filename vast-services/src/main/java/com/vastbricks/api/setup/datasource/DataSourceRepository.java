package com.vastbricks.api.setup.datasource;

import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface DataSourceRepository extends JpaRepository<DataSource, Long> {

    List<DataSource> findAllByOrderByNameAsc();

    Optional<DataSource> findByNameIgnoreCase(String name);
}
