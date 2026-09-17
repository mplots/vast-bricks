package com.vastbricks.api.shippingprice;

import com.vastbricks.api.client.latvijaspasts.LatvijasPastsClient;
import com.vastbricks.api.client.latvijaspasts.LatvijasPastsCountry;
import com.vastbricks.api.client.latvijaspasts.LatvijasPastsPriceResponse;
import com.vastbricks.api.client.latvijaspasts.LatvijasPastsWorkFlow;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sweeps the Latvijas Pasts tariff into the table.
 *
 * <p>One weight, deliberately heavier than anything the post office carries. Asked about it, the provider answers
 * with every band of every service rather than with an error, so a full sweep of 250 destinations and every band up
 * to 30 kg is around fifty requests instead of two thousand. The requests are paced between countries.
 *
 * <p>Nothing is overwritten. A price the provider still states moves only its {@code checked_at}; one that has moved
 * closes the row that held it and opens another, so the table answers what a band cost on the day an order shipped
 * as readily as what it costs now.
 *
 * <p>Reading is deliberately outside any transaction: {@link ShippingPriceStore} opens a short one per destination.
 * A sweep is the better part of a minute of HTTP, and one transaction around all of it would hold a connection for
 * the whole sweep and throw away everything read so far the moment one destination failed - the debug dock's record
 * of the traffic included, which is the one thing worth having after a failure.
 */
@Component
@RequiredArgsConstructor
@Slf4j
class ShippingPriceSync {

    /**
     * The weight every sweep asks about: 40 kg, heavier than the 30 kg maximum of any destination.
     *
     * <p>Not a realistic weight, and that is the point. A weight the provider can carry is answered with the single
     * price for it; a weight nothing can carry is answered with the whole ladder.
     */
    private static final int OVER_MAXIMUM_GRAMS = 40_000;

    /**
     * The weight the ladder is checked against afterwards, and the band it must land in.
     *
     * <p>Bands are read from where their prices fall once the ladder is sorted, which holds only while a heavier
     * band never costs less. Rather than assume that, the sweep asks the provider outright what 500 g costs and
     * abandons the run if the ladder disagrees.
     */
    private static final int PROBE_GRAMS = 500;

    private final LatvijasPastsClient client;
    private final ShippingPriceRepository repository;
    private final ShippingPriceStore store;

    /** How recently swept is recent enough to leave alone, the job firing once per tenant over one global table. */
    static final Duration FRESH_FOR = Duration.ofHours(12);

    /** Whether the table was confirmed recently enough that another sweep would ask the same questions again. */
    @Transactional(readOnly = true)
    boolean isFresh() {
        return repository.findFirstByValidToIsNullOrderByCheckedAtAsc()
                .map(price -> price.getCheckedAt().isAfter(Instant.now().minus(FRESH_FOR)))
                .orElse(false);
    }

    ShippingPriceSyncTally sweep() {
        List<LatvijasPastsCountry> countries = client.listCountries();
        ShippingPriceSyncTally tally = new ShippingPriceSyncTally();
        Instant sweptAt = Instant.now();

        boolean probed = false;

        for (List<LatvijasPastsCountry> batch : batches(countries)) {
            if (Thread.currentThread().isInterrupted()) {
                // Someone stopped the run. What has been swept stands; the rest keeps the prices it already had.
                break;
            }

            LatvijasPastsPriceResponse response = client.pricesByCountry(codesOf(batch), OVER_MAXIMUM_GRAMS);
            for (LatvijasPastsCountry country : batch) {
                List<ShippingPriceBand> bands = bandsOf(response, country, tally);
                if (bands.isEmpty()) {
                    continue;
                }
                if (!probed) {
                    // Once per sweep, and on the first destination that priced anything: the reading of a ladder is
                    // the same reading for every country, so one disagreement condemns all of them.
                    verify(country, bands);
                    probed = true;
                }
                store.store(country, bands, sweptAt, tally);
            }
            pace();
        }

        return tally;
    }

    /**
     * Asks the provider what a real weight costs and checks the ladder said the same.
     *
     * <p>The one guard over reading bands by position. A tariff whose ladder did not rise with weight would be read
     * wrongly and silently, and this is what makes that loud instead.
     */
    private void verify(LatvijasPastsCountry country, List<ShippingPriceBand> bands) {
        LatvijasPastsPriceResponse probe = client.pricesByCountry(List.of(country.getCode()), PROBE_GRAMS);
        for (LatvijasPastsWorkFlow workFlow : workFlowsOf(probe, country.getCode())) {
            ShippingPriceLadder.Kind kind = ShippingPriceLadder.kindOf(workFlow);
            if (kind == null || workFlow.getMaxWeightInKg() != null) {
                // Not a service that is stored, or one this weight is already too heavy for.
                continue;
            }

            // A quote for a weight the provider can carry is a single price, not a ladder. Anything else is not a
            // quote this can check against, and is passed over rather than read as a disagreement.
            BigDecimal stated = ShippingPriceLadder.singlePrice(workFlow);
            if (stated == null) {
                continue;
            }

            BigDecimal read = bands.stream()
                    .filter(band -> band.getShipmentType() == kind.getShipmentType()
                            && band.getService() == kind.getService()
                            && band.covers(PROBE_GRAMS))
                    .map(ShippingPriceBand::getBasePrice)
                    .findFirst()
                    .orElse(null);

            if (read == null || read.compareTo(stated) != 0) {
                throw new ShippingPriceException(
                        "The Latvijas Pasts ladder for " + workFlow.getLabel() + " does not agree with what it states"
                                + " for " + PROBE_GRAMS + " g to " + country.getCode() + ": the ladder reads " + read
                                + " and the provider states " + stated
                );
            }
        }
    }

    /** One destination's bands, across every service stored, or nothing where the provider priced it at all. */
    private List<ShippingPriceBand> bandsOf(
            LatvijasPastsPriceResponse response,
            LatvijasPastsCountry country,
            ShippingPriceSyncTally tally
    ) {
        List<LatvijasPastsWorkFlow> workFlows = workFlowsOf(response, country.getCode());
        if (workFlows.isEmpty()) {
            tally.skipped++;
            return List.of();
        }

        List<ShippingPriceBand> bands = new ArrayList<>();
        for (LatvijasPastsWorkFlow workFlow : workFlows) {
            if (ShippingPriceLadder.kindOf(workFlow) == null) {
                continue;
            }
            try {
                bands.addAll(ShippingPriceLadder.read(workFlow));
            } catch (ShippingPriceException exception) {
                // One destination described oddly is not a reason to write the other 250 wrongly.
                log.warn("Latvijas Pasts priced {} in a shape a tariff does not come in: {}",
                        country.getCode(), exception.getMessage());
                tally.skipped++;
                return List.of();
            }
        }
        if (bands.isEmpty()) {
            tally.skipped++;
        }
        return bands;
    }

    private static List<LatvijasPastsWorkFlow> workFlowsOf(LatvijasPastsPriceResponse response, String countryCode) {
        if (response.getWorkFlows() == null) {
            return List.of();
        }
        return response.getWorkFlows().stream()
                .filter(workFlow -> countryCode.equals(workFlow.getCountryCode()))
                .toList();
    }

    private static List<String> codesOf(List<LatvijasPastsCountry> batch) {
        return batch.stream().map(LatvijasPastsCountry::getCode).toList();
    }

    /** The destinations in groups of the most the provider will price at once. */
    private static List<List<LatvijasPastsCountry>> batches(List<LatvijasPastsCountry> countries) {
        List<List<LatvijasPastsCountry>> batches = new ArrayList<>();
        for (int from = 0; from < countries.size(); from += LatvijasPastsClient.MAX_COUNTRIES_PER_REQUEST) {
            batches.add(countries.subList(
                    from, Math.min(from + LatvijasPastsClient.MAX_COUNTRIES_PER_REQUEST, countries.size())
            ));
        }
        return batches;
    }

    /** Waits between requests. An interruption here is someone stopping the run, and is left standing for the loop. */
    private void pace() {
        int delay = client.requestDelayMillis();
        if (delay <= 0) {
            return;
        }
        try {
            Thread.sleep(delay);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
