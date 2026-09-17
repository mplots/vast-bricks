package com.vastbricks.api.shippingprice;

import com.vastbricks.api.client.latvijaspasts.LatvijasPastsWeightCost;
import com.vastbricks.api.client.latvijaspasts.LatvijasPastsWorkFlow;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Turns one of the provider's ways of sending into weight bands.
 *
 * <p>This exists because the provider states a ladder of prices with no weight against any of them. Asked about a
 * weight nothing can carry, it hands over every band of every service at once - which is what makes a whole
 * country's tariff one request - but it hands them over as a bare list, unordered, with the insured variant mixed
 * in among them.
 *
 * <p>So a band is worked out from where its price falls once the ladder is sorted. That is sound because a heavier
 * band never costs less than a lighter one, which is a fact about tariffs rather than about this code - and it is
 * therefore checked rather than trusted: {@link ShippingPriceSync} probes a known weight against the ladder it just
 * read and abandons a sweep the two disagree about.
 *
 * <p>Only three of the provider's ways of sending are read. The rest - courier delivery, parcel machines, the
 * premium and insured services, and {@code letter}, which is the tariff book's Vestule and is for documents - are
 * not what a store posting bricks buys.
 */
final class ShippingPriceLadder {

    /** The tariff book's Sikpaka bands, by the heaviest gram each covers. Five, always, for every destination. */
    private static final int[] SMALL_PACKET_BANDS = {20, 100, 500, 1000, 2000};

    /** A Paka's first band covers everything up to a kilogram, and each band after it one kilogram more. */
    private static final int PARCEL_BAND_GRAMS = 1000;

    /** A delivery estimate: one number, or two with a dash between them and whitespace wherever it pleased. */
    private static final Pattern DELIVERY_DAYS = Pattern.compile("(\\d{1,3})(?:\\s*-\\s*(\\d{1,3}))?");

    private ShippingPriceLadder() {
    }

    /** Which of the stored services this way of sending is, or null for one that is not stored. */
    static Kind kindOf(LatvijasPastsWorkFlow workFlow) {
        return switch (String.valueOf(workFlow.getLabel())) {
            case "parcel-economy-small" -> new Kind(ShipmentType.SMALL_PACKET, ShippingService.ECONOMY, false);
            case "parcel-standard-small" -> new Kind(ShipmentType.SMALL_PACKET, ShippingService.STANDARD, true);
            case "parcel-standardPlus-large" -> new Kind(ShipmentType.PARCEL, ShippingService.STANDARD_PLUS, false);
            default -> null;
        };
    }

    /**
     * The bands of one way of sending, read from the full ladder the provider answered an over-maximum weight with.
     *
     * <p>A ladder of the wrong length is refused rather than guessed at. A Sikpaka has five bands and nothing else
     * is a Sikpaka; a Paka has one per kilogram and one of no bands at all prices nothing.
     */
    static List<ShippingPriceBand> read(LatvijasPastsWorkFlow workFlow) {
        Kind kind = kindOf(workFlow);
        if (kind == null) {
            return List.of();
        }

        List<Integer> prices = sortedPrices(workFlow);
        if (prices.isEmpty()) {
            throw new ShippingPriceException("Latvijas Pasts stated no prices for " + workFlow.getLabel());
        }
        // A price stated twice means this is not one ladder. For St Helena the provider answers with two of them
        // under the same label - two ranges of ten kilograms priced identically, from two different runs of its own
        // tariff - and sorting the twenty prices together would read them as twenty one-kilogram bands, putting the
        // two-kilogram price on the three-kilogram band and every band after it out by one. Refused rather than
        // guessed at: the destination is skipped and counted, which is a gap a reader can see, where a silently
        // wrong tariff is not.
        if (Set.copyOf(prices).size() != prices.size()) {
            throw new ShippingPriceException(
                    "Latvijas Pasts states " + prices.size() + " prices for " + workFlow.getLabel()
                            + " but only " + Set.copyOf(prices).size()
                            + " distinct ones, so they are not one ladder of weight bands"
            );
        }

        BigDecimal tracking = kind.isTracked() ? euros(workFlow.trackingCost()) : BigDecimal.ZERO;
        int[] days = deliveryDays(workFlow.getDeliveryDays());
        return kind.getShipmentType() == ShipmentType.SMALL_PACKET
                ? smallPacketBands(kind, prices, tracking, days)
                : parcelBands(kind, prices, tracking, days);
    }

    private static List<ShippingPriceBand> smallPacketBands(
            Kind kind, List<Integer> prices, BigDecimal tracking, int[] days
    ) {
        if (prices.size() != SMALL_PACKET_BANDS.length) {
            throw new ShippingPriceException(
                    "Latvijas Pasts stated " + prices.size() + " small packet prices where a tariff has "
                            + SMALL_PACKET_BANDS.length
            );
        }

        List<ShippingPriceBand> bands = new ArrayList<>();
        int from = 0;
        for (int index = 0; index < SMALL_PACKET_BANDS.length; index++) {
            int to = SMALL_PACKET_BANDS[index];
            bands.add(band(kind, from, to, prices.get(index), tracking, days));
            from = to + 1;
        }
        return List.copyOf(bands);
    }

    private static List<ShippingPriceBand> parcelBands(
            Kind kind, List<Integer> prices, BigDecimal tracking, int[] days
    ) {
        List<ShippingPriceBand> bands = new ArrayList<>();
        for (int index = 0; index < prices.size(); index++) {
            // The first band covers everything up to a kilogram; every band after it starts a gram over the last.
            int to = (index + 1) * PARCEL_BAND_GRAMS;
            int from = index == 0 ? 0 : index * PARCEL_BAND_GRAMS + 1;
            bands.add(band(kind, from, to, prices.get(index), tracking, days));
        }
        return List.copyOf(bands);
    }

    private static ShippingPriceBand band(
            Kind kind, int from, int to, Integer cents, BigDecimal tracking, int[] days
    ) {
        return ShippingPriceBand.builder()
                .shipmentType(kind.getShipmentType())
                .service(kind.getService())
                .weightFromGrams(from)
                .weightToGrams(to)
                .basePrice(euros(cents))
                .trackingFee(tracking)
                .deliveryDaysMin(days == null ? null : days[0])
                .deliveryDaysMax(days == null ? null : days[1])
                .build();
    }

    /**
     * How long the provider says this takes, as a fewest and a most.
     *
     * <p>It writes an estimate as {@code 15 - 20}, as {@code 15-20}, and once with a trailing space, all meaning the
     * same thing, and as a bare {@code 16} where it offers one number rather than a range. Parsed into two numbers so
     * that a destination whose estimate the provider merely reformats does not read as one whose estimate changed.
     * Anything else it might write is taken as no estimate rather than guessed at: a wait is worth less than a price
     * and is not worth failing a destination over.
     */
    static int[] deliveryDays(String stated) {
        if (stated == null || stated.isBlank()) {
            return null;
        }
        Matcher matcher = DELIVERY_DAYS.matcher(stated.trim());
        if (!matcher.matches()) {
            return null;
        }
        int least = Integer.parseInt(matcher.group(1));
        int most = matcher.group(2) == null ? least : Integer.parseInt(matcher.group(2));
        return new int[] {Math.min(least, most), Math.max(least, most)};
    }

    /**
     * The one price this way of sending was quoted, for a weight it can actually carry, or null where it was quoted
     * anything else. What the sweep's check reads, a quote for a real weight being a single price and not a ladder.
     */
    static BigDecimal singlePrice(LatvijasPastsWorkFlow workFlow) {
        List<Integer> prices = sortedPrices(workFlow);
        return prices.size() == 1 ? euros(prices.get(0)) : null;
    }

    /**
     * The ladder's own prices, ascending.
     *
     * <p>The insured variant is dropped first. It arrives interleaved in the same list as the service it insures,
     * and sorting the two together would read one ladder of twice the length.
     */
    private static List<Integer> sortedPrices(LatvijasPastsWorkFlow workFlow) {
        if (workFlow.getWeightCosts() == null) {
            return List.of();
        }
        return workFlow.getWeightCosts().stream()
                .filter(cost -> !cost.isInsurance())
                .map(LatvijasPastsWeightCost::getPriceWithTax)
                .filter(price -> price != null)
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    /** A price as money. The provider counts in whole cents, VAT included. */
    static BigDecimal euros(Integer cents) {
        return cents == null ? BigDecimal.ZERO : BigDecimal.valueOf(cents, 2);
    }

    /** What a stored way of sending is: which of the two shipment types, which service, and whether it is tracked. */
    @Getter
    @AllArgsConstructor
    static final class Kind {
        private final ShipmentType shipmentType;
        private final ShippingService service;
        private final boolean tracked;
    }
}
