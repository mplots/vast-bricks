package com.vastbricks.api.orderarchive;

import com.vastbricks.api.client.bricklink.BrickLinkClient;
import com.vastbricks.api.client.bricklink.BrickLinkOrder;
import com.vastbricks.api.client.bricklink.BrickLinkOrderDocument;
import com.vastbricks.api.client.brickowl.BrickOwlClient;
import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickowl.BrickOwlOrderDocument;
import com.vastbricks.api.client.brickowl.BrickOwlOrderListItem;
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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

/**
 * Keeps the store's own copy of what its marketplaces held for an order.
 *
 * <p>Every file is named after the moment the order last changed, so an order that changes again is archived again
 * beside its earlier state rather than over it. BrickLink states three: its API record of the order, the accounting
 * export a store sees under its own account, and, where BrickLink collected the VAT, the invoice it issued for it.
 * BrickOwl states one, its own record of the order, since it offers nothing answering to the other two. An order
 * whose files are already there is left alone, which is what makes running this nightly cheap.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderArchive {

    private final OrderArchiveSettings settings;
    private final TenantRoster tenants;
    private final BrickLinkClient brickLink;
    private final BrickOwlClient brickOwl;
    private final BrickStoreClient brickStore;

    /** Archives every order either marketplace lists for the bound tenant, and says what that came to. */
    ArchiveTally archiveAll() {
        Path directory = directory();
        var tally = new ArchiveTally();

        // A marketplace is archived whatever the other one did: a BrickLink token that stopped working must not take
        // the BrickOwl archive down with it for however long it takes somebody to notice. A store that could not be
        // listed at all still fails the run, once both have had their turn.
        RuntimeException brickLinkFailure = failureOf("BrickLink", () -> archiveBrickLinkOrders(directory, tally));
        RuntimeException brickOwlFailure = failureOf("BrickOwl", () -> archiveBrickOwlOrders(directory, tally));
        if (Thread.currentThread().isInterrupted()) {
            log.info("Order archive stopped after {} order(s)", tally.archived + tally.unchanged + tally.failed);
        }
        if (brickLinkFailure != null && brickOwlFailure != null) {
            throw new OrderArchiveException(
                    brickLinkFailure.getMessage() + "; " + brickOwlFailure.getMessage(), brickLinkFailure);
        }
        if (brickLinkFailure != null) {
            throw brickLinkFailure;
        }
        if (brickOwlFailure != null) {
            throw brickOwlFailure;
        }
        return tally;
    }

    /** Runs one marketplace's half and hands back what stopped it, so the other half still gets its turn. */
    private RuntimeException failureOf(String marketplace, Runnable half) {
        try {
            half.run();
            return null;
        } catch (RuntimeException exception) {
            log.error("Could not archive the store's {} orders", marketplace, exception);
            return exception;
        }
    }

    private void archiveBrickLinkOrders(Path directory, ArchiveTally tally) {
        for (BrickLinkOrder order : brickLink.listOrders()) {
            // Stopping a run interrupts this thread, and every order is archived under a catch that would otherwise
            // read the interruption as one order that could not be archived and carry on through the rest. What has
            // been archived stays archived, so the tally so far is what the run came to.
            if (Thread.currentThread().isInterrupted()) {
                return;
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
    }

    /**
     * Archives every order BrickOwl lists, by reading each of them.
     *
     * <p>BrickOwl's list says nothing about when an order last changed, so unlike BrickLink there is no telling an
     * order already on disk from one that has changed without asking for the order itself. Its batch endpoint answers
     * fifty at a time, which is what makes reading the whole store nightly a handful of calls rather than one an
     * order, and a page is also as much as is held in memory at once.
     */
    private void archiveBrickOwlOrders(Path directory, ArchiveTally tally) {
        if (Thread.currentThread().isInterrupted()) {
            return;
        }

        var orderIds = new ArrayList<String>();
        for (BrickOwlOrderListItem listed : brickOwl.listOrders()) {
            if (listed == null || StringUtils.isBlank(listed.getOrderId())) {
                log.warn("Skipped a BrickOwl order the list named no order id for");
                tally.failed++;
            } else {
                orderIds.add(listed.getOrderId());
            }
        }

        for (int start = 0; start < orderIds.size(); start += BrickOwlClient.MAX_BATCH_REQUESTS) {
            if (Thread.currentThread().isInterrupted()) {
                return;
            }
            List<String> page = orderIds.subList(
                    start, Math.min(start + BrickOwlClient.MAX_BATCH_REQUESTS, orderIds.size()));
            List<BrickOwlOrderDocument> documents;
            try {
                documents = brickOwl.getOrders(page);
            } catch (Exception exception) {
                // A page BrickOwl would not answer is that page's orders, not the run's: the rest still can be.
                tally.failed += page.size();
                log.error("Could not read {} BrickOwl order(s) from {}", page.size(), page.getFirst(), exception);
                continue;
            }
            // An order BrickOwl left out of its answer is one this run could not archive, and the client has said
            // which and why. Counting the difference is how it reaches the tally.
            tally.failed += page.size() - documents.size();

            for (BrickOwlOrderDocument document : documents) {
                try {
                    if (archive(directory, document)) {
                        tally.archived++;
                    } else {
                        tally.unchanged++;
                    }
                } catch (Exception exception) {
                    tally.failed++;
                    log.error("Could not archive BrickOwl order {}", document.getOrder().getOrderId(), exception);
                }
            }
        }
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

    private boolean archive(Path directory, BrickOwlOrderDocument document) {
        BrickOwlOrder order = document.getOrder();
        String orderId = order == null ? null : order.getOrderId();
        if (StringUtils.isBlank(orderId)) {
            throw new IllegalStateException("BrickOwl stated an order with no order_id");
        }
        LocalDateTime changed = lastChanged(order);
        if (changed == null) {
            throw new IllegalStateException("BrickOwl order " + orderId + " states no time it last changed");
        }

        Path path = directory.resolve("brickowl-api-" + part(orderId) + "-" + part(changed.toString()) + ".json");
        if (Files.exists(path)) {
            return false;
        }
        try {
            Files.createDirectories(directory);
            Files.writeString(path, document.getJson(), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
        } catch (IOException exception) {
            throw new OrderArchiveException("Could not write the archive of BrickOwl order " + orderId, exception);
        }

        log.info("Archived BrickOwl order {} as it stood at {}", orderId, changed);
        return true;
    }

    /**
     * The moment BrickOwl last stated a change to the order.
     *
     * <p>{@code updated_time} is the one that moves whenever anything about the order does. The others stand in for
     * a store whose orders predate it: an order that was never touched after it was placed changed when it was
     * placed, and archiving it under that is better than refusing to archive it at all.
     */
    private static LocalDateTime lastChanged(BrickOwlOrder order) {
        return ObjectUtils.firstNonNull(
                order.getUpdatedTime(), order.getProcessedTime(), order.getIsoOrderTime(), order.getOrderTime());
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
        String moment = part(changed);
        return new ArchivePaths(
                directory.resolve("api-" + orderId + "-" + moment + ".json"),
                directory.resolve("accounting-" + orderId + "-" + moment + ".xml"),
                directory.resolve("vat-invoice-" + orderId + "-" + moment + ".pdf"));
    }

    /** A provider's own wording, reduced to what a file name may be made of. */
    private static String part(String value) {
        return value.trim().replaceAll("[^A-Za-z0-9._:+-]", "-");
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
