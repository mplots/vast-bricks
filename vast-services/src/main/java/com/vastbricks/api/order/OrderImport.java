package com.vastbricks.api.order;

import com.vastbricks.api.client.bricklink.BrickLinkClient;
import com.vastbricks.api.client.bricklink.BrickLinkOrder;
import com.vastbricks.api.client.brickowl.BrickOwlClient;
import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderRefund;
import com.vastbricks.api.orderarchive.OrderArchive;
import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import com.vastbricks.api.reconciliation.ReconciliationCurrency;
import com.vastbricks.api.reconciliation.ReconciliationPaymentMethod;
import com.vastbricks.api.reconciliation.order.OrderLinks;
import com.vastbricks.api.tax.FacilitatorTaxes;
import com.vastbricks.api.tax.OrderTaxTypes;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

/**
 * Reads the store's order archive into the database, so its orders can be asked questions the files cannot answer.
 *
 * <p>The archive is the source rather than the marketplaces themselves: what is stored is then always something the
 * store holds its own copy of, and importing costs no provider call at all.
 *
 * <p>An order is archived once per state it was in, so the same order is on disk several times over. The import
 * takes the latest state of each and upserts it: an order not held yet is inserted, one whose latest state is newer
 * than the row is updated, and one already stored as its latest state is left alone. That last is the common case,
 * which is what makes running this after every archive cheap.
 */
@Component
@RequiredArgsConstructor
@Slf4j
class OrderImport {

    /**
     * An archived file, as the archive names them: {@code marketplace-kind-orderId-moment}.
     *
     * <p>Every kind is matched and the reader picks the ones it wants, because the moment is what ties one order's
     * files together: a BrickLink order is read out of two of them, and they are the two written under the same
     * moment. A kind nothing reads is matched and then dropped, which costs a regex and keeps the name in one place.
     */
    private static final Pattern ARCHIVED_FILE =
            Pattern.compile("^([a-z]+)-([a-z]+)-(.+)-(\\d{4}-\\d{2}-\\d{2}T.+)\\.[a-z]+$");

    private final OrderArchive archive;
    private final OrderRepository orders;
    private final BrickLinkClient brickLink;
    private final BrickOwlClient brickOwl;
    private final BrickStoreClient brickStore;

    /**
     * Imports the latest archived state of every order the bound tenant has archived, and says what that came to.
     *
     * <p>Forced, it reads every order again whether or not the archive holds a later state of it, which is how a
     * change in the reading of a file reaches rows that were written under the old one.
     */
    ImportTally importAll(boolean force) {
        Path directory = archive.directory();
        var tally = new ImportTally();

        for (ArchivedOrder archived : latestPerOrder(directory, tally)) {
            // Stopping a job interrupts this thread, and every order is imported under a catch that would otherwise
            // read the interruption as one order that could not be imported and carry on through the rest. What has
            // been imported stays imported, so the tally so far is what the run came to.
            if (Thread.currentThread().isInterrupted()) {
                break;
            }
            try {
                tally.count(upsert(archived, force));
            } catch (Exception exception) {
                // One order that could not be imported is not a failed run: the rest of the archive still can be.
                tally.failed++;
                log.error("Could not import the archived {} order {} as it stood at {}",
                        archived.getSource(), archived.getOrderId(), archived.getArchivedAt(), exception);
            }
        }

        // One line a run, not one an order: a first run imports a store's whole history, and which orders those were
        // is the tally's business and a debug line's.
        log.info("Order import {}: {} imported, {} updated, {} unchanged, {} failed",
                Thread.currentThread().isInterrupted() ? "stopped" : "finished",
                tally.imported, tally.updated, tally.unchanged, tally.failed);
        return tally;
    }

    /**
     * The latest archived state of each order, with the files that state was archived as.
     *
     * <p>Only the latest is read: the earlier states of an order are what it used to be, and the row holds what it
     * is. The files of one state are the ones sharing its moment, so a state archived without one of its kinds is
     * read out of the kinds it has rather than out of an earlier state that happens to hold the missing one.
     */
    private List<ArchivedOrder> latestPerOrder(Path directory, ImportTally tally) {
        if (!Files.isDirectory(directory)) {
            // A store that has never archived has no orders to import, which is not a failure.
            log.info("Nothing to import: {} holds no order archive yet", directory);
            return List.of();
        }

        var latest = new LinkedHashMap<String, ArchivedOrder>();
        try (Stream<Path> files = Files.list(directory)) {
            for (Path path : files.sorted().toList()) {
                collect(latest, path, tally);
            }
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not read the order archive in " + directory, exception);
        }
        return List.copyOf(latest.values());
    }

    /** Files one archived file under the order and state it belongs to, or passes over a file nothing reads. */
    private void collect(Map<String, ArchivedOrder> latest, Path path, ImportTally tally) {
        Matcher name = ARCHIVED_FILE.matcher(path.getFileName().toString());
        if (!name.matches()) {
            return;
        }
        ArchiveKind kind = ArchiveKind.of(name.group(2));
        if (kind == null) {
            // The detail page and anything the archive gains later: the same order in a form nothing here reads.
            return;
        }
        OrderSource source = sourceOf(name.group(1));
        if (source == null) {
            // A marketplace this import does not know is a file it must not guess the shape of, and a store that
            // started archiving one would otherwise import nothing from it silently.
            log.warn("Skipped {}: no marketplace of that name is imported", path.getFileName());
            tally.failed++;
            return;
        }
        Instant archivedAt = instantOf(name.group(4));
        if (archivedAt == null) {
            log.warn("Skipped {}: its name states no moment that can be read", path.getFileName());
            tally.failed++;
            return;
        }

        String orderId = name.group(3);
        ArchivedOrder held = latest.get(source + "-" + orderId);
        if (held == null || archivedAt.isAfter(held.getArchivedAt())) {
            held = new ArchivedOrder(source, orderId, archivedAt);
            latest.put(source + "-" + orderId, held);
        }
        if (!archivedAt.isBefore(held.getArchivedAt())) {
            held.files.put(kind, path);
        }
    }

    /** Which marketplace a file's name says it holds, by the same prefix the archive wrote it under. */
    private static OrderSource sourceOf(String prefix) {
        for (OrderSource source : OrderSource.values()) {
            if (source.prefix().equals(prefix)) {
                return source;
            }
        }
        return null;
    }

    /**
     * Stores an order's latest archived state, if the archive holds it later than the database does.
     *
     * <p>The files are read only once they are known to be worth reading: the common run is one over a store whose
     * orders are all already stored as their latest state. A forced run reads them anyway, which is the only way a
     * row whose order has not changed since it was written is written again.
     */
    private Outcome upsert(ArchivedOrder archived, boolean force) throws IOException {
        Order stored = orders.findBySourceAndOrderId(archived.getSource(), archived.getOrderId()).orElse(null);
        if (!force && stored != null && !archived.getArchivedAt().isAfter(stored.getArchivedAt())) {
            return Outcome.UNCHANGED;
        }

        Order order = stored == null ? new Order(archived.getSource(), archived.getOrderId()) : stored;
        switch (archived.getSource()) {
            case BRICKLINK -> applyBrickLink(order, archived);
            case BRICKOWL -> applyBrickOwl(order, archived);
        }
        order.setArchivedAt(archived.getArchivedAt());
        order.setUpdatedAt(Instant.now());
        orders.save(order);
        return stored == null ? Outcome.IMPORTED : Outcome.UPDATED;
    }

    /**
     * A BrickLink order, out of the accounting export first and its API record only for what the export leaves out.
     *
     * <p>The export is the store's own account of the order, so every field is taken from it where it has one and
     * the API record answers for the rest - which today is both names of the buyer, and whatever the export was
     * never written for a given state of the order.
     */
    /*
     * A field the export states blank is a field the export does not have: BrickStore writes an empty element rather
     * than leaving one out, so every text preference below is trimmed to null before it is preferred. An empty
     * string that won the preference would beat an API record that actually states the field.
     */
    private void applyBrickLink(Order order, ArchivedOrder archived) throws IOException {
        BrickStoreOrder exported = exported(archived);
        // Read only when the export left something out, so an order the export fully states costs one file.
        Supplier<BrickLinkOrder> stated = lazily(() -> stated(archived));

        order.setOrderUrl(OrderLinks.brickLink(order.getOrderId()));
        order.setOrderDate(required(
                preferring(exported == null ? null : dayOf(exported.getOrderDate()),
                        () -> instantOf(value(stated.get(), BrickLinkOrder::getDateOrdered))),
                order, "an order date"));
        order.setLotCount(preferring(exported == null ? null : exported.getTotalLots(),
                () -> value(stated.get(), BrickLinkOrder::getUniqueCount)));
        order.setItemCount(preferring(exported == null ? null : exported.getTotalItems(),
                () -> value(stated.get(), BrickLinkOrder::getTotalCount)));
        // Both names of the buyer off the order's own record, which states each of them unambiguously: buyer_name is
        // the account and the shipping address is the person. The export states one or the other under a single
        // BUYER element, according to how the request that fetched it was asked - so it cannot be read for either
        // without knowing that, and an archive holds files fetched under whatever the request was at the time.
        order.setBuyer(StringUtils.trimToNull(shippedTo(stated.get())));
        order.setBuyerUsername(StringUtils.trimToNull(value(stated.get(), BrickLinkOrder::getBuyerName)));
        order.setPaymentMethod(ReconciliationPaymentMethod.normalize(
                preferring(exported == null ? null : StringUtils.trimToNull(exported.getPaymentType()),
                        () -> payment(stated.get(), BrickLinkOrder.Payment::getMethod))));
        // What the buyer paid in, which need not be what the order is totalled in: the grand total below is the
        // store's own base currency, as the reconciliation report states it.
        order.setCurrency(ReconciliationCurrency.normalize(
                preferring(exported == null ? null : StringUtils.trimToNull(exported.getPaymentCurrencyCode()),
                        () -> payment(stated.get(), BrickLinkOrder.Payment::getCurrencyCode))));
        // Only the export states enough to type an order for tax or to say what the marketplace collected on it.
        // An order archived without one carries neither rather than a guess from the fields that are left.
        order.setTaxType(exported == null ? null : OrderTaxTypes.of(exported));
        order.setFacilitatorTax(exported == null ? null : ReconciliationAmount.normalize(FacilitatorTaxes.of(exported)));
        order.setSubTotal(ReconciliationAmount.normalize(preferring(exported == null ? null : exported.getTotal(),
                () -> amountOf(cost(stated.get(), BrickLinkOrder.Cost::getSubtotal)))));
        order.setShippingCost(ReconciliationAmount.normalize(preferring(exported == null ? null : exported.getShipping(),
                () -> amountOf(cost(stated.get(), BrickLinkOrder.Cost::getShipping)))));
        order.setGrandTotal(ReconciliationAmount.normalize(preferring(exported == null ? null : exported.getBaseGrandTotal(),
                () -> amountOf(cost(stated.get(), BrickLinkOrder.Cost::getGrandTotal)))));
        // Neither of the other two files names a refund: BrickLink states one on the order detail page alone, which
        // is the third file the archive keeps and the only reason this import reads it.
        order.setRefundedAmount(refunded(archived));
    }

    /** What the archived order detail page says came back, or null where it says nothing did. */
    private BigDecimal refunded(ArchivedOrder archived) throws IOException {
        Path path = archived.files.get(ArchiveKind.DETAIL);
        if (path == null) {
            return null;
        }
        BrickStoreOrderRefund refund = brickStore.readOrderRefund(Files.readString(path, StandardCharsets.UTF_8));
        return refund == null ? null : ReconciliationAmount.normalize(refund.getAmount());
    }

    /** BrickOwl states one record of an order and nothing beside it, so there is nothing to prefer over it. */
    private void applyBrickOwl(Order order, ArchivedOrder archived) throws IOException {
        Path path = archived.files.get(ArchiveKind.API);
        if (path == null) {
            throw new IllegalStateException("BrickOwl order " + archived.getOrderId() + " is archived with no record of it");
        }
        BrickOwlOrder stated = brickOwl.readOrder(Files.readString(path, StandardCharsets.UTF_8));

        // BrickOwl states several times an order was placed at, and the client reads every one of them to the same
        // moment in UTC whichever spelling it arrived in, so the zone put back here is the one it was read to.
        LocalDateTime placed = ObjectUtils.firstNonNull(stated.getIsoOrderTime(), stated.getOrderTime());
        order.setOrderUrl(OrderLinks.brickOwl(order.getOrderId()));
        order.setOrderDate(required(placed == null ? null : placed.toInstant(ZoneOffset.UTC), order, "an order date"));
        order.setLotCount(stated.getTotalLots());
        order.setItemCount(stated.getTotalQuantity());
        order.setBuyer(StringUtils.trimToNull(stated.getBuyerName()));
        order.setBuyerUsername(StringUtils.trimToNull(stated.getCustomerUsername()));
        order.setPaymentMethod(ReconciliationPaymentMethod.normalize(stated.getPaymentMethodType()));
        order.setCurrency(ReconciliationCurrency.normalize(stated.getPaymentCurrency()));
        order.setTaxType(OrderTaxTypes.of(stated));
        order.setFacilitatorTax(ReconciliationAmount.normalize(FacilitatorTaxes.of(stated)));
        order.setSubTotal(ReconciliationAmount.normalize(stated.getSubTotal()));
        order.setShippingCost(ReconciliationAmount.normalize(stated.getShipping()));
        order.setGrandTotal(ReconciliationAmount.normalize(stated.getBaseOrderTotal()));
        order.setRefundedAmount(refundedBy(stated));
    }

    /**
     * What BrickOwl reports came back on an order, or null where it reports nothing did.
     *
     * <p>BrickOwl states a refund total on every order, writing {@code 0.00} where nothing came back, so a zero is
     * the marketplace reporting no refund and is kept as no amount rather than as an amount of nothing - exactly as
     * the reconciliation report reads it.
     */
    private static BigDecimal refundedBy(BrickOwlOrder stated) {
        BigDecimal refunded = ReconciliationAmount.normalize(stated.getRefundTotal());
        return refunded == null || refunded.signum() == 0 ? null : refunded;
    }

    /** The order the accounting export states, or {@code null} where this state was archived without one. */
    private BrickStoreOrder exported(ArchivedOrder archived) throws IOException {
        Path path = archived.files.get(ArchiveKind.ACCOUNTING);
        if (path == null) {
            return null;
        }
        List<BrickStoreOrder> stated = brickStore.readOrderExport(Files.readAllBytes(path));
        // An export is written per order, so it states the one it was asked for. It is matched by id all the same:
        // an export holding somebody else's order must not be read as this one's.
        return stated.stream()
                .filter(order -> order.getOrderId() != null && archived.getOrderId().equals(String.valueOf(order.getOrderId())))
                .findFirst()
                .orElse(null);
    }

    /** The order BrickLink's own record states, or {@code null} where this state was archived without one. */
    private BrickLinkOrder stated(ArchivedOrder archived) {
        Path path = archived.files.get(ArchiveKind.API);
        if (path == null) {
            return null;
        }
        try {
            return brickLink.readOrder(Files.readString(path, StandardCharsets.UTF_8));
        } catch (IOException exception) {
            throw new UncheckedIOException("Could not read " + path, exception);
        }
    }

    /** The preferred value, or what the fallback states where the preferred source has nothing to say. */
    private static <T> T preferring(T preferred, Supplier<T> fallback) {
        return preferred != null ? preferred : fallback.get();
    }

    /** Reads once, however many fields ask for it, and not at all if none of them does. */
    private static <T> Supplier<T> lazily(Supplier<T> read) {
        return new Supplier<>() {

            private boolean taken;
            private T held;

            @Override
            public T get() {
                if (!taken) {
                    held = read.get();
                    taken = true;
                }
                return held;
            }
        };
    }

    private static <T> T value(BrickLinkOrder order, Function<BrickLinkOrder, T> field) {
        return order == null ? null : field.apply(order);
    }

    /**
     * The name the order is shipped to, which is the buyer's own.
     *
     * <p>It is the shipping recipient rather than a registered buyer name, so an order sent to somebody else names
     * that person. BrickLink states no other name anywhere in what the archive keeps, and a name that is whose
     * parcel it is beats no name at all.
     */
    private static String shippedTo(BrickLinkOrder order) {
        BrickLinkOrder.Shipping shipping = order == null ? null : order.getShipping();
        BrickLinkOrder.Address address = shipping == null ? null : shipping.getAddress();
        BrickLinkOrder.Name name = address == null ? null : address.getName();
        return name == null ? null : name.getFull();
    }

    private static <T> T cost(BrickLinkOrder order, Function<BrickLinkOrder.Cost, T> field) {
        BrickLinkOrder.Cost stated = order == null ? null : order.getCost();
        return stated == null ? null : field.apply(stated);
    }

    private static <T> T payment(BrickLinkOrder order, Function<BrickLinkOrder.Payment, T> field) {
        BrickLinkOrder.Payment stated = order == null ? null : order.getPayment();
        return stated == null ? null : field.apply(stated);
    }

    /**
     * A day as the accounting export states it, read as the moment that day began.
     *
     * <p>The export states a day and no time of day, so the time is what preferring it costs. It is the right price:
     * an order is reported by the day it was placed, and the export is the store's own account of that day.
     */
    private static Instant dayOf(LocalDate day) {
        return day == null ? null : day.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    /**
     * When an order was placed, which is the one field it is not an order without.
     *
     * <p>Everything else a marketplace may legitimately leave out, and a row stating no buyer is still an order; a
     * row stating no date is a row nothing can be read in order of.
     */
    private static Instant required(Instant moment, Order order, String field) {
        if (moment == null) {
            throw new IllegalStateException(
                    order.getSource() + " order " + order.getOrderId() + " is archived stating " + field + " nowhere");
        }
        return moment;
    }

    /**
     * A moment as a marketplace or an archived file name states it.
     *
     * <p>Three spellings, because the two marketplaces do not agree and neither does the archive: an instant in UTC,
     * a moment with an offset of its own, and one with no zone at all, which is read as UTC.
     */
    private static Instant instantOf(String value) {
        String stated = StringUtils.trimToNull(value);
        if (stated == null) {
            return null;
        }
        try {
            return Instant.parse(stated);
        } catch (DateTimeParseException ignored) {
            // Not an instant, so one of the other two spellings - or nothing this can read.
        }
        try {
            return OffsetDateTime.parse(stated).toInstant();
        } catch (DateTimeParseException ignored) {
            // Left with the zoneless spelling.
        }
        try {
            return LocalDateTime.parse(stated).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private static BigDecimal amountOf(String value) {
        String stated = StringUtils.trimToNull(value);
        try {
            return stated == null ? null : new BigDecimal(stated);
        } catch (NumberFormatException exception) {
            throw new IllegalStateException("An order states an amount that is not a number: " + stated, exception);
        }
    }

    /** The kinds of file an order is read out of. The archive writes others, and this is what says so. */
    private enum ArchiveKind {

        /** The marketplace's own record of the order: BrickLink's order JSON, BrickOwl's. */
        API("api"),

        /** The accounting export a BrickLink store sees under its own account, which names the buyer. */
        ACCOUNTING("accounting"),

        /** The order detail page, which is the only place BrickLink states a refund. */
        DETAIL("detail");

        private final String kind;

        ArchiveKind(String kind) {
            this.kind = kind;
        }

        static ArchiveKind of(String stated) {
            for (ArchiveKind kind : values()) {
                if (kind.kind.equals(stated)) {
                    return kind;
                }
            }
            return null;
        }
    }

    /** One order's latest archived state, and the files that state was archived as. */
    @Getter
    private static final class ArchivedOrder {

        private final OrderSource source;

        private final String orderId;

        private final Instant archivedAt;

        private final Map<ArchiveKind, Path> files = new EnumMap<>(ArchiveKind.class);

        ArchivedOrder(OrderSource source, String orderId, Instant archivedAt) {
            this.source = source;
            this.orderId = orderId;
            this.archivedAt = archivedAt;
        }
    }

    /** What storing one archived order came to. */
    private enum Outcome {
        IMPORTED, UPDATED, UNCHANGED
    }

    /** What importing a store's archive came to. */
    static final class ImportTally {

        int imported;
        int updated;
        int unchanged;
        int failed;

        void count(Outcome outcome) {
            switch (outcome) {
                case IMPORTED -> imported++;
                case UPDATED -> updated++;
                case UNCHANGED -> unchanged++;
            }
        }
    }
}
