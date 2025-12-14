package com.vastbricks.job;

import lombok.extern.slf4j.Slf4j;
import org.postgresql.copy.CopyManager;
import org.postgresql.core.BaseConnection;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StopWatch;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Component
@Slf4j
public class RebrickableSyncJob {

    private static final String DOWNLOAD_PATTERN = "https://cdn.rebrickable.com/media/downloads/%s.%s";
    private static final List<TableImport> TABLES = List.of(
            new TableImport("rebrickable.themes", "themes", List.of("id", "name", "parent_id")),
            new TableImport("rebrickable.colors", "colors", List.of("id", "name", "rgb", "is_trans", "num_parts", "num_sets", "y1", "y2")),
            new TableImport("rebrickable.part_categories", "part_categories", List.of("id", "name")),
            new TableImport("rebrickable.parts", "parts", List.of("part_num", "name", "part_cat_id", "part_material")),
            new TableImport("rebrickable.part_relationships", "part_relationships", List.of("rel_type", "child_part_num", "parent_part_num")),
            new TableImport("rebrickable.elements", "elements", List.of("element_id", "part_num", "color_id", "design_id")),
            new TableImport("rebrickable.sets", "sets", List.of("set_num", "name", "year", "theme_id", "num_parts", "img_url")),
            new TableImport("rebrickable.minifigs", "minifigs", List.of("fig_num", "name", "num_parts", "img_url")),
            new TableImport("rebrickable.inventories", "inventories", List.of("id", "version", "set_num")),
            new TableImport("rebrickable.inventory_parts", "inventory_parts", List.of("inventory_id", "part_num", "color_id", "quantity", "is_spare", "img_url")),
            new TableImport("rebrickable.inventory_sets", "inventory_sets", List.of("inventory_id", "set_num", "quantity")),
            new TableImport("rebrickable.inventory_minifigs", "inventory_minifigs", List.of("inventory_id", "fig_num", "quantity"))
    );

    private final DataSource dataSource;
    private final HttpClient httpClient;

    public RebrickableSyncJob(DataSource dataSource) {
        this.dataSource = dataSource;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

//    @Scheduled(cron = "0 30 3 * * *")
    public void runJob() {
        runJobAsync();
    }

    @Async
    public void runJobAsync() {
        log.info("Starting Rebrickable synchronization job");
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                truncateTables(connection);
                var copyManager = new CopyManager(connection.unwrap(BaseConnection.class));
                for (var table : TABLES) {
                    loadTable(copyManager, table);
                }
                connection.commit();
                log.info("Rebrickable synchronization job completed");
            } catch (Exception e) {
                connection.rollback();
                throw e;
            }
        } catch (Exception e) {
            log.error("Rebrickable synchronization job failed", e);
        }
    }

    private void truncateTables(Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.execute("""
                TRUNCATE TABLE rebrickable.inventory_parts, rebrickable.inventory_sets, rebrickable.inventory_minifigs,
                rebrickable.inventories, rebrickable.elements, rebrickable.part_relationships, rebrickable.parts,
                rebrickable.sets, rebrickable.minifigs, rebrickable.colors, rebrickable.themes, rebrickable.part_categories
                RESTART IDENTITY CASCADE
            """);
        }
    }

    private void loadTable(CopyManager copyManager, TableImport table) throws IOException, InterruptedException, SQLException {
        var copySql = "COPY %s (%s) FROM STDIN WITH (FORMAT csv, HEADER true)".formatted(
                table.tableName(), String.join(",", table.columns())
        );

        var watch = new StopWatch();
        watch.start();
        try (var csvStream = openCsvStream(table.sourceName());
             var reader = new InputStreamReader(csvStream, StandardCharsets.UTF_8)) {
            copyManager.copyIn(copySql, reader);
        }
        watch.stop();
        log.info("Loaded {} in {} seconds", table.tableName(), watch.getTotalTimeSeconds());
    }

    private InputStream openCsvStream(String table) throws IOException, InterruptedException {
        IOException lastError;
        var extension = "csv.gz";
        var url = DOWNLOAD_PATTERN.formatted(table, extension);
        var request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMinutes(2))
                .GET()
                .build();
        var response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() == 404) {
            response.body().close();
            log.debug("Download for {} not found at {}. Trying next option.", table, url);
        }
        if (response.statusCode() >= 300) {
            response.body().close();
            throw new IOException("Failed to download %s (%s): HTTP %s".formatted(table, extension, response.statusCode()));
        }

        var bodyStream = response.body();
        try {
            return new GZIPInputStream(bodyStream);
        } catch (IOException ex) {
            bodyStream.close();
            lastError = ex;
            log.debug("Failed to open {}", table, ex.getMessage());
        }

        if (lastError != null) {
            throw lastError;
        }
        throw new IOException("Could not find a download for table " + table);
    }

    private record TableImport(String tableName, String sourceName, List<String> columns) {}
}
