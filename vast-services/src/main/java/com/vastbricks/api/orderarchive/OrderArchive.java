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
import com.vastbricks.api.setup.provideraccount.OperatingPeriod;
import com.vastbricks.api.setup.provideraccount.Provider;
import com.vastbricks.api.setup.provideraccount.ProviderAccounts;
import com.vastbricks.api.tenancy.TenantContext;
import com.vastbricks.api.tenancy.TenantRoster;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
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

    /** What a VAT invoice is called in the middle of an archived file's name, between the marketplace and the order. */
    private static final String VAT_INVOICE_KIND = "vat-invoice";

    private static final String VAT_INVOICE_SUFFIX = ".pdf";

    /**
     * How BrickLink states a moment, and therefore how the order's other files are named: always to the millisecond,
     * always in UTC. An invoice is named through this rather than through {@code Instant.toString()}, which drops a
     * zero millisecond and would file the invoice under a moment spelled differently from its own siblings.
     */
    private static final DateTimeFormatter ARCHIVE_MOMENT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private final OrderArchiveSettings settings;
    private final TenantRoster tenants;
    private final ProviderAccounts providerAccounts;
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
        OperatingPeriod operating = providerAccounts.operatingPeriod(Provider.BRICK_LINK);
        int outside = 0;
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
            if (outside(operating, dateOf(order.getDateOrdered()))) {
                outside++;
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
        reportOutside("BrickLink", outside);
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

        OperatingPeriod operating = providerAccounts.operatingPeriod(Provider.BRICK_OWL);
        int outside = 0;
        var orderIds = new ArrayList<String>();
        for (BrickOwlOrderListItem listed : brickOwl.listOrders()) {
            if (listed == null || StringUtils.isBlank(listed.getOrderId())) {
                log.warn("Skipped a BrickOwl order the list named no order id for");
                tally.failed++;
            } else if (outside(operating, dateOf(listed.getOrderDate()))) {
                outside++;
            } else {
                orderIds.add(listed.getOrderId());
            }
        }
        reportOutside("BrickOwl", outside);

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

    /**
     * Every BrickLink order id the bound tenant's archive holds a VAT invoice for.
     *
     * <p>Asked as a listing rather than one order at a time because a reader wants the month: reconciliation judges
     * every order of a period at once, and one directory listing answers for all of them where a question per order
     * would be a listing per order.
     *
     * <p>The invoice is the one file of the archive this application does not fetch. BrickLink issues it only where
     * it collected the VAT itself, and it is posted here by the browser extension rather than fetched, so an order
     * with none is the ordinary case and this says nothing about whether one was due. That is the reader's
     * judgement, not the archive's.
     *
     * <p>An archive no order has ever been written to holds nothing, which is not a failure: a store whose first
     * nightly run has not happened yet is a store with an empty archive.
     */
    public Set<String> vatInvoiceOrderIds() {
        Path directory = directory();
        if (!Files.isDirectory(directory)) {
            return Set.of();
        }
        String prefix = OrderSource.BRICKLINK.prefix() + "-" + VAT_INVOICE_KIND + "-";
        try (Stream<Path> files = Files.list(directory)) {
            return files.map(file -> file.getFileName().toString())
                    .filter(name -> name.startsWith(prefix) && name.endsWith(VAT_INVOICE_SUFFIX))
                    .map(name -> orderIdOf(name, prefix))
                    .filter(StringUtils::isNotBlank)
                    .collect(Collectors.toUnmodifiableSet());
        } catch (IOException exception) {
            throw new OrderArchiveException("Could not read the store's order archive at " + directory, exception);
        }
    }

    /**
     * The order id out of {@code bricklink-vat-invoice-<orderId>-<changed>.pdf}, or null where the name carries none.
     *
     * <p>Up to the first dash after the prefix, because the moment that follows holds dashes of its own and the order
     * id holds none. A name with nothing after the prefix is not one of these files however much it looks like one.
     */
    private static String orderIdOf(String name, String prefix) {
        String rest = name.substring(prefix.length());
        int end = rest.indexOf('-');
        return end < 0 ? null : rest.substring(0, end);
    }

    /**
     * Writes the VAT invoice BrickLink issued for an order into the bound tenant's archive, and says whether
     * anything was written.
     *
     * <p>The one file of the archive this application does not fetch. BrickLink serves the invoice only to the
     * signed-in store, so it is the browser extension that downloads it and posts it to {@link VatInvoiceService},
     * and this part is the same as for every other file: name it as the order's others are named, and leave an
     * invoice already on disk alone.
     *
     * <p>The moment is the caller's because the invoice itself states none: it is the moment the order last changed,
     * which is what the order's other files are named after, so the invoice files beside them rather than under a
     * moment of its own.
     */
    boolean storeVatInvoice(String orderId, Instant changed, byte[] pdf) {
        Path directory = directory();
        Path path = directory.resolve(
                OrderSource.BRICKLINK.prefix() + "-" + VAT_INVOICE_KIND + "-" + part(orderId) + "-"
                        + part(ARCHIVE_MOMENT.format(changed)) + VAT_INVOICE_SUFFIX);
        if (Files.exists(path)) {
            return false;
        }
        try {
            Files.createDirectories(directory);
            Files.write(path, pdf, StandardOpenOption.CREATE_NEW);
        } catch (IOException exception) {
            throw new OrderArchiveException("Could not write the VAT invoice of BrickLink order " + orderId, exception);
        }
        log.info("Archived the VAT invoice of BrickLink order {} as it stood at {}", orderId, changed);
        return true;
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
            boolean detailWanted = !paths.detailArchived();
            String detail = detailWanted ? brickStore.getOrderDetailHtml(String.valueOf(orderId)) : null;

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
            } else if (detailWanted) {
                // BrickLink has purged the page and will not serve it again, so what the archive keeps of it is the
                // fact that it is gone. Without this the order is never complete and every night asks once more.
                Files.writeString(paths.getPurged(),
                        "BrickLink no longer serves the detail page of order " + orderId
                                + ". Noted " + LocalDateTime.now() + ".\n",
                        StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
                written.add("detail purged");
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

        Path path = directory.resolve(
                OrderSource.BRICKOWL.prefix() + "-api-" + part(orderId) + "-" + part(changed.toString()) + ".json");
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

    /**
     * The order's accounting export, which BrickLink states for an order however old it is.
     *
     * <p>Asked for without real names, so its {@code BUYER} is the buyer's account. The export states one or the
     * other and never both, and the account is the one that means the same thing here as everywhere else: it is what
     * the marketplace's own record calls the buyer, what the live collection reads, and what a store looking an order
     * up types in. The person behind it is on the order's own record, as the address it was shipped to.
     *
     * <p>An empty export is BrickLink saying this account has no such order, and an empty file would read ever after
     * as an order whose accounting record is genuinely blank. Better one order counted as failed, loudly, tonight.
     */
    private byte[] exportOf(long orderId) {
        byte[] exported = brickStore.exportOrders(
                BrickStoreOrderExportRequest.forOrderId(BrickStoreOrderType.RECEIVED, String.valueOf(orderId), false));
        if (exported.length == 0) {
            throw new OrderArchiveException("BrickLink stated no accounting export for order " + orderId);
        }
        return exported;
    }

    /**
     * Whether the order was placed outside the stretch the store's provider account says counts.
     *
     * <p>One marketplace login can hold orders that were never this tenant's - sold personally before the store was a
     * business, or by whoever else holds the login - and two tenants sharing a login are told apart by nothing else.
     * An archive of somebody else's orders is the same mistake as reconciling them, with the store's own copy of a
     * buyer's name and address written under the wrong tenant's directory to show for it.
     *
     * <p>By the date the order was placed, which is the date it belonged to whoever was selling then, and which both
     * listings state. An order the listing dates unreadably is archived rather than dropped: the archive is a copy,
     * and a copy too many is a far smaller wrong than a missing one.
     */
    private static boolean outside(OperatingPeriod operating, LocalDate ordered) {
        return operating.excludes(ordered);
    }

    /**
     * One line a run for the orders that were not this tenant's, not one an order.
     *
     * <p>They are no part of the tally: an order outside the operating period is another store's, and a run that
     * counted it as unchanged would report the archive as holding orders it deliberately does not.
     */
    private static void reportOutside(String marketplace, int outside) {
        if (outside > 0) {
            log.info("Left {} {} order(s) dated outside the store's operating period to the store they belong to",
                    outside, marketplace);
        }
    }

    /** The date a marketplace's listing states an order was placed on, in UTC, or null where it states none it reads. */
    private static LocalDate dateOf(String stated) {
        if (StringUtils.isBlank(stated)) {
            return null;
        }
        try {
            return OffsetDateTime.parse(stated.trim()).withOffsetSameInstant(ZoneOffset.UTC).toLocalDate();
        } catch (DateTimeException exception) {
            log.warn("Could not read the date a marketplace stated an order was placed on: {}", stated);
            return null;
        }
    }

    private static LocalDate dateOf(LocalDateTime stated) {
        return stated == null ? null : stated.toLocalDate();
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
        String name = OrderSource.BRICKLINK.prefix() + "-";
        return new ArchivePaths(
                changed,
                directory.resolve(name + "api-" + orderId + "-" + moment + ".json"),
                directory.resolve(name + "accounting-" + orderId + "-" + moment + ".xml"),
                directory.resolve(name + "detail-" + orderId + "-" + moment + ".html"),
                // Its own kind rather than another detail file: what reads the archive tells one file from another by
                // that word, and a note about the page filed as the page is a note that would be read as one.
                directory.resolve(name + "purged-" + orderId + "-" + moment + ".txt"));
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

        /** Where the archive notes that BrickLink has purged the detail page, beside where the page itself would be. */
        private final Path purged;

        /** The page, or the note saying there will never be one: either settles the detail half of this archive. */
        boolean detailArchived() {
            return Files.exists(detail) || Files.exists(purged);
        }

        boolean complete() {
            return Files.exists(api) && Files.exists(accounting) && detailArchived();
        }
    }

    /** What archiving a store's orders came to. */
    static final class ArchiveTally {

        int archived;
        int unchanged;
        int failed;
    }
}
