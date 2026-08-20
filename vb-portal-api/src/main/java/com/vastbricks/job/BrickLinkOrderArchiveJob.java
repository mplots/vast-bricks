package com.vastbricks.job;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import com.vastbricks.integration.bricklink.LinkAPIClient;
import com.vastbricks.integration.bricklink.LinkAPIResponse;
import com.vastbricks.integration.bricklink.LinkInternalClient;
import com.vastbricks.integration.bricklink.LinkOrder;
import com.vastbricks.integration.bricklink.OrderExportRequest;
import com.vastbricks.integration.bricklink.OrderType;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@RequiredArgsConstructor
@Slf4j
public class BrickLinkOrderArchiveJob {
    private final Env env;
    private final LinkAPIClient apiClient;
    private final LinkInternalClient internalClient;
    private final ObjectMapper objectMapper;
    private final AtomicBoolean running = new AtomicBoolean();

    @Scheduled(cron = "0 0 3 * * *")
    public void runJob() {
        runJobAsync();
    }

    @Async
    public void runJobAsync() {
        if (!running.compareAndSet(false, true)) {
            log.info("BrickLink order archive skipped: job is already running");
            return;
        }

        try {
            archiveOrders();
        } catch (Exception ex) {
            log.error("BrickLink order archive failed", ex);
        } finally {
            running.set(false);
        }
    }

    public boolean archiveOrder(long orderId) throws IOException {
        if (orderId <= 0) {
            throw new IllegalArgumentException("orderId must be positive");
        }
        var archiveDirectory = archiveDirectory();
        if (archiveDirectory == null) {
            throw new IllegalStateException("BRICKLINK_ORDER_ARCHIVE_DIR is not configured");
        }
        Files.createDirectories(archiveDirectory);

        var rawJson = apiClient.getOrderRaw(orderId);
        var order = deserializeOrder(rawJson, orderId);
        return archiveOrder(archiveDirectory, order, rawJson, order);
    }

    private void archiveOrders() throws IOException {
        var archiveDirectory = archiveDirectory();
        if (archiveDirectory == null) {
            return;
        }
        Files.createDirectories(archiveDirectory);

        var response = apiClient.getOrders();
        if (response == null || response.getData() == null || response.getData().isEmpty()) {
            log.info("BrickLink order archive finished: no orders returned");
            return;
        }

        var archived = 0;
        var skipped = 0;
        var failed = 0;
        for (var order : response.getData()) {
            if (order == null || order.getOrderId() == null) {
                log.warn("BrickLink order archive skipped an order without order_id");
                failed++;
                continue;
            }
            try {
                if (alreadyArchived(archiveDirectory, order)) {
                    skipped++;
                    continue;
                }
                if (archiveOrder(archiveDirectory, order)) {
                    archived++;
                } else {
                    skipped++;
                }
            } catch (Exception ex) {
                failed++;
                log.error("Failed to archive BrickLink order {}", order.getOrderId(), ex);
            }
        }
        log.info(
            "BrickLink order archive finished: archived {}, unchanged {}, failed {}",
            archived,
            skipped,
            failed
        );
    }

    private boolean archiveOrder(Path directory, LinkOrder summary) throws IOException {
        var orderId = summary.getOrderId();
        var rawJson = apiClient.getOrderRaw(orderId);
        var order = deserializeOrder(rawJson, orderId);
        return archiveOrder(directory, summary, rawJson, order);
    }

    private boolean archiveOrder(
        Path directory,
        LinkOrder summary,
        String rawJson,
        LinkOrder order
    ) throws IOException {
        var orderId = summary.getOrderId();
        var dateStatusChanged = StringUtils.defaultIfBlank(
            order.getDateStatusChanged(),
            summary.getDateStatusChanged()
        );
        if (StringUtils.isBlank(dateStatusChanged)) {
            throw new IllegalStateException("BrickLink order " + orderId + " has no date_status_changed");
        }

        var paths = archivePaths(directory, orderId, dateStatusChanged);
        var vatInvoiceRequired = Boolean.TRUE.equals(order.getVatCollectedByBrickLink());
        if (Files.exists(paths.getApi())
            && Files.exists(paths.getAccounting())
            && (!vatInvoiceRequired || Files.exists(paths.getVatInvoice()))) {
            return false;
        }

        byte[] rawXml = null;
        if (!Files.exists(paths.getAccounting())) {
            rawXml = internalClient.exportOrders(
                OrderExportRequest.forOrderId(OrderType.RECEIVED, orderId.toString())
            );
        }
        if (!Files.exists(paths.getApi())) {
            Files.writeString(
                paths.getApi(),
                rawJson,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE_NEW
            );
        }
        if (!Files.exists(paths.getAccounting())) {
            Files.write(paths.getAccounting(), rawXml, StandardOpenOption.CREATE_NEW);
        }
        if (vatInvoiceRequired && !Files.exists(paths.getVatInvoice())) {
            var rawVatInvoice = internalClient.downloadVatInvoice(orderId);
            Files.write(paths.getVatInvoice(), rawVatInvoice, StandardOpenOption.CREATE_NEW);
        }
        log.info("Archived BrickLink order {} changed at {}", orderId, dateStatusChanged);
        return true;
    }

    private LinkOrder deserializeOrder(String rawJson, long orderId) {
        try {
            LinkAPIResponse<LinkOrder> response = objectMapper.readValue(
                rawJson,
                new TypeReference<LinkAPIResponse<LinkOrder>>() { }
            );
            if (response == null || response.getData() == null) {
                throw new IllegalStateException("BrickLink API returned no data for order " + orderId);
            }
            return response.getData();
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not deserialize BrickLink order " + orderId, ex);
        }
    }

    private boolean alreadyArchived(Path directory, LinkOrder order) {
        var orderId = order.getOrderId();
        var dateStatusChanged = order.getDateStatusChanged();
        if (StringUtils.isBlank(dateStatusChanged)) {
            return false;
        }
        var paths = archivePaths(directory, orderId, dateStatusChanged);
        return Files.exists(paths.getApi())
            && Files.exists(paths.getAccounting())
            && (!Boolean.TRUE.equals(order.getVatCollectedByBrickLink()) || Files.exists(paths.getVatInvoice()));
    }

    private ArchivePaths archivePaths(Path directory, long orderId, String dateStatusChanged) {
        var timestamp = safeFilenamePart(dateStatusChanged);
        return new ArchivePaths(
            directory.resolve("api-" + orderId + "-" + timestamp + ".json"),
            directory.resolve("accounting-" + orderId + "-" + timestamp + ".xml"),
            directory.resolve("vat-invoice-" + orderId + "-" + timestamp + ".pdf")
        );
    }

    private String safeFilenamePart(String value) {
        return value.trim().replaceAll("[^A-Za-z0-9._:+-]", "-");
    }

    private Path archiveDirectory() {
        if (StringUtils.isBlank(env.getBrickLinkOrderArchiveDir())) {
            log.info("BrickLink order archive skipped: BRICKLINK_ORDER_ARCHIVE_DIR not configured");
            return null;
        }
        return Path.of(env.getBrickLinkOrderArchiveDir().trim());
    }

    @Getter
    @AllArgsConstructor
    private static class ArchivePaths {
        private final Path api;
        private final Path accounting;
        private final Path vatInvoice;
    }
}
