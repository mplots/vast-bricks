package com.vastbricks.api.orderarchive;

import com.vastbricks.api.client.bricklink.BrickLinkClient;
import com.vastbricks.api.client.bricklink.BrickLinkOrder;
import com.vastbricks.api.client.bricklink.BrickLinkOrderDocument;
import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrderExportRequest;
import com.vastbricks.api.client.brickstore.BrickStoreOrderType;
import com.vastbricks.api.tenancy.TenantContext;
import com.vastbricks.api.tenancy.TenantRoster;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Keeps the store's own copy of what BrickLink held for an order.
 *
 * <p>Three files per order, named after the moment the order last changed, so an order that changes again is
 * archived again beside its earlier state rather than over it: BrickLink's API record of the order, the accounting
 * export a store sees under its own account, and, where BrickLink collected the VAT, the invoice it issued for it.
 * An order whose three files are already there is left alone, which is what makes running this nightly cheap.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderArchive {

    private final OrderArchiveSettings settings;
    private final TenantRoster tenants;
    private final BrickLinkClient brickLink;
    private final BrickStoreClient brickStore;

    /** Archives every order BrickLink lists for the bound tenant, and says what that came to. */
    ArchiveTally archiveAll() {
        Path directory = directory();
        var tally = new ArchiveTally();

        for (BrickLinkOrder order : brickLink.listOrders()) {
            // Stopping a run interrupts this thread, and every order is archived under a catch that would otherwise
            // read the interruption as one order that could not be archived and carry on through the rest. What has
            // been archived stays archived, so the tally so far is what the run came to.
            if (Thread.currentThread().isInterrupted()) {
                log.info("BrickLink order archive stopped after {} order(s)", tally.archived + tally.unchanged + tally.failed);
                break;
            }
            if (order == null || order.getOrderId() == null) {
                log.warn("Skipped a BrickLink order the list named no order id for");
                tally.failed++;
                continue;
            }
            try {
                if (isArchived(directory, order.getOrderId(), order.getDateStatusChanged(), order)) {
                    tally.unchanged++;
                } else if (archive(directory, order)) {
                    tally.archived++;
                } else {
                    tally.unchanged++;
                }
            } catch (Exception exception) {
                // One order that could not be archived is not a failed run: the rest of the month still can be.
                tally.failed++;
                log.error("Could not archive BrickLink order {}", order.getOrderId(), exception);
            }
        }
        return tally;
    }

    /** Archives one order by id, for the bound tenant, and says whether anything was written. */
    public boolean archive(long orderId) {
        if (orderId <= 0) {
            throw new IllegalArgumentException("orderId must be positive");
        }
        return archive(directory(), null, brickLink.getOrder(orderId));
    }

    private boolean archive(Path directory, BrickLinkOrder listed) {
        return archive(directory, listed, brickLink.getOrder(listed.getOrderId()));
    }

    private boolean archive(Path directory, BrickLinkOrder listed, BrickLinkOrderDocument document) {
        BrickLinkOrder order = document.getOrder();
        long orderId = order.getOrderId() != null ? order.getOrderId() : listed.getOrderId();
        String changed = stated(order.getDateStatusChanged(), listed == null ? null : listed.getDateStatusChanged());
        if (changed == null) {
            throw new IllegalStateException("BrickLink order " + orderId + " states no date_status_changed");
        }

        ArchivePaths paths = pathsOf(directory, orderId, changed);
        boolean vatInvoiceIssued = Boolean.TRUE.equals(order.getVatCollectedByBrickLink());
        if (paths.complete(vatInvoiceIssued)) {
            return false;
        }

        try {
            Files.createDirectories(directory);
            // Fetched before anything is written, so a provider that will not answer leaves no half-archived order.
            byte[] accounting = Files.exists(paths.getAccounting()) ? null : exportOf(orderId);
            byte[] vatInvoice = vatInvoiceIssued && !Files.exists(paths.getVatInvoice())
                    ? brickStore.downloadVatInvoice(String.valueOf(orderId))
                    : null;

            if (!Files.exists(paths.getApi())) {
                Files.writeString(paths.getApi(), document.getJson(), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
            }
            if (accounting != null) {
                Files.write(paths.getAccounting(), accounting, StandardOpenOption.CREATE_NEW);
            }
            if (vatInvoice != null) {
                Files.write(paths.getVatInvoice(), vatInvoice, StandardOpenOption.CREATE_NEW);
            }
        } catch (IOException exception) {
            throw new OrderArchiveException("Could not write the archive of BrickLink order " + orderId, exception);
        }

        log.info("Archived BrickLink order {} as it stood at {}", orderId, changed);
        return true;
    }

    private byte[] exportOf(long orderId) {
        return brickStore.exportOrders(
                BrickStoreOrderExportRequest.forOrderId(BrickStoreOrderType.RECEIVED, String.valueOf(orderId)));
    }

    private boolean isArchived(Path directory, long orderId, String changed, BrickLinkOrder listed) {
        if (changed == null || changed.isBlank()) {
            return false;
        }
        return pathsOf(directory, orderId, changed).complete(Boolean.TRUE.equals(listed.getVatCollectedByBrickLink()));
    }

    /**
     * The tenant's own archive directory, under the configured base.
     *
     * <p>By tenant code rather than by id: a directory a person has to look in should name the store it holds.
     */
    public Path directory() {
        String base = settings.getDirectory();
        if (base == null || base.isBlank()) {
            throw new OrderArchiveException("VAST_ORDER_ARCHIVE_DIR is not configured");
        }
        String code = tenants.byId(TenantContext.currentTenantIdOrNone())
                .orElseThrow(() -> new OrderArchiveException("An order archive belongs to a tenant, and this run has none"))
                .getCode();
        return Path.of(base.trim()).resolve(code);
    }

    private static ArchivePaths pathsOf(Path directory, long orderId, String changed) {
        String moment = changed.trim().replaceAll("[^A-Za-z0-9._:+-]", "-");
        return new ArchivePaths(
                directory.resolve("api-" + orderId + "-" + moment + ".json"),
                directory.resolve("accounting-" + orderId + "-" + moment + ".xml"),
                directory.resolve("vat-invoice-" + orderId + "-" + moment + ".pdf"));
    }

    private static String stated(String preferred, String fallback) {
        if (preferred != null && !preferred.isBlank()) {
            return preferred.trim();
        }
        return fallback == null || fallback.isBlank() ? null : fallback.trim();
    }

    /** What one order's archive is written to. */
    @Getter
    @AllArgsConstructor
    private static final class ArchivePaths {

        private final Path api;
        private final Path accounting;
        private final Path vatInvoice;

        boolean complete(boolean vatInvoiceIssued) {
            return Files.exists(api)
                    && Files.exists(accounting)
                    && (!vatInvoiceIssued || Files.exists(vatInvoice));
        }
    }

    /** What archiving a store's orders came to. */
    static final class ArchiveTally {

        int archived;
        int unchanged;
        int failed;
    }
}
