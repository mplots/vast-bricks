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
 * <p>Every file is named {@code marketplace-kind-orderId-moment}: the marketplace first, because one directory
 * holds both stores and an order id says nothing about which of them issued it, and the moment the order last
 * changed last, so an order that changes again is archived again beside its earlier state rather than over it.
 * BrickLink states three kinds: its API record of the order, the accounting export a store sees under its own
 * account, and the order detail page that account is shown. BrickOwl states one, its own record of the order, since
 * it offers nothing answering to the others. An order whose files are already there is left alone, which is what
 * makes running this nightly cheap.
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
        // One line a run, not one an order: a run that catches a whole store's history up writes as many orders as
        // the store has ever had, and which of them it was is the tally's business and a debug line's.
        log.info("Order archive {}: {} archived, {} unchanged, {} failed",
                Thread.currentThread().isInterrupted() ? "stopped" : "finished",
                tally.archived, tally.unchanged, tally.failed);
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
                if (archive(directory, order)) {
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
        // Asked for by id and nothing else, so there is no listing to say what state the order is in: it says itself.
        return archive(directory(), orderId, brickLink.getOrder(orderId));
    }

    /**
     * Archives one listed order, asking BrickLink for the order itself only when its own record is what is missing.
     *
     * <p>The list states {@code date_status_changed} for every order, which is the moment the archive names its files
     * after, so whether this state of the order is already on disk is answerable without a request. Reading the order
     * to find that out is what made a nightly run cost one request an order rather than one listing.
     */
    private boolean archive(Path directory, BrickLinkOrder listed) {
        long orderId = listed.getOrderId();
        String changed = stated(listed.getDateStatusChanged());
        if (changed == null) {
            // BrickLink not answering as it does, rather than a state of its own: the order is read for its moment.
            return archive(directory, orderId, brickLink.getOrder(orderId));
        }

        ArchivePaths paths = pathsOf(directory, orderId, changed);
        if (paths.complete()) {
            return false;
        }
        return write(directory, paths, orderId, Files.exists(paths.getApi()) ? null : brickLink.getOrder(orderId));
    }

    private boolean archive(Path directory, long orderId, BrickLinkOrderDocument document) {
        String changed = stated(document.getOrder().getDateStatusChanged());
        if (changed == null) {
            throw new IllegalStateException("BrickLink order " + orderId + " states no date_status_changed");
        }
        ArchivePaths paths = pathsOf(directory, orderId, changed);
        return !paths.complete() && write(directory, paths, orderId, document);
    }

    /**
     * Writes whatever of the order's archive is missing, fetching only that.
     *
     * <p>A null document is the order's own record already being on disk, which is the common case for an order one
     * of the pages could not be had for: what is fetched is that page, and not the order a second time.
     */
    private boolean write(Path directory, ArchivePaths paths, long orderId, BrickLinkOrderDocument document) {
        var written = new ArrayList<String>();
        try {
            Files.createDirectories(directory);
            // Fetched before anything is written, so a provider that will not answer leaves no half-archived order.
            byte[] accounting = Files.exists(paths.getAccounting()) ? null : exportOf(orderId);
            String detail = Files.exists(paths.getDetail()) ? null : brickStore.getOrderDetailHtml(String.valueOf(orderId));

            if (document != null && !Files.exists(paths.getApi())) {
                Files.writeString(paths.getApi(), document.getJson(), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
                written.add("api");
            }
            if (accounting != null) {
                Files.write(paths.getAccounting(), accounting, StandardOpenOption.CREATE_NEW);
                written.add("accounting");
            }
            if (detail != null) {
                Files.writeString(paths.getDetail(), detail, StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
                written.add("detail");
            }
        } catch (IOException exception) {
            throw new OrderArchiveException("Could not write the archive of BrickLink order " + orderId, exception);
        }

        if (written.isEmpty()) {
            return false;
        }
        // Which files, because an order that was archived in full reads very differently from a whole store's worth
        // of orders that were each missing one page: the second is a catch-up, and says so.
        log.info("Archived BrickLink order {} as it stood at {}: {}", orderId, paths.getChanged(), String.join(", ", written));
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
                changed,
                directory.resolve("bricklink-api-" + orderId + "-" + moment + ".json"),
                directory.resolve("bricklink-accounting-" + orderId + "-" + moment + ".xml"),
                directory.resolve("bricklink-detail-" + orderId + "-" + moment + ".html"));
    }

    /** A provider's own wording, reduced to what a file name may be made of. */
    private static String part(String value) {
        return value.trim().replaceAll("[^A-Za-z0-9._:+-]", "-");
    }

    private static String stated(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** What one order's archive is written to, and the moment it is the archive of. */
    @Getter
    @AllArgsConstructor
    private static final class ArchivePaths {

        private final String changed;

        private final Path api;

        private final Path accounting;

        private final Path detail;

        boolean complete() {
            return Files.exists(api) && Files.exists(accounting) && Files.exists(detail);
        }
    }

    /** What archiving a store's orders came to. */
    static final class ArchiveTally {

        int archived;
        int unchanged;
        int failed;
    }
}
