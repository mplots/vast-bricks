package com.vastbricks.api.shippingprice;

import com.vastbricks.api.client.latvijaspasts.LatvijasPastsCountry;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes one destination's tariff, in a transaction of its own.
 *
 * <p>A bean apart from {@link ShippingPriceSync} so that the transaction is only ever around the writing. A sweep is
 * fifty HTTP requests over the better part of a minute, and holding one transaction across all of it would keep a
 * database connection open for the whole sweep, discard every destination already read if the last one failed, and —
 * least obviously and most annoyingly — take the debug dock's record of the traffic down with it, since those rows
 * are written through the same transaction. The one thing a reader wants after a sweep fails is what it sent.
 *
 * <p>Per destination rather than per sweep, so a sweep that stops halfway keeps what it had already read, and the
 * next one carries on from there rather than starting again.
 */
@Component
@RequiredArgsConstructor
class ShippingPriceStore {

    private final ShippingPriceRepository repository;

    @Transactional
    void store(
            LatvijasPastsCountry country,
            List<ShippingPriceBand> bands,
            Instant sweptAt,
            ShippingPriceSyncTally tally
    ) {
        Map<String, ShippingPrice> current = currentByBand(country.getCode());
        List<ShippingPrice> opening = new ArrayList<>();

        for (ShippingPriceBand band : bands) {
            ShippingPrice held = current.remove(bandKey(band));
            if (held == null) {
                opening.add(rowOf(country, band, sweptAt));
                tally.added++;
            } else if (held.statesSameOffer(band)) {
                held.setCheckedAt(sweptAt);
                tally.unchanged++;
            } else {
                held.setValidTo(sweptAt);
                opening.add(rowOf(country, band, sweptAt));
                tally.changed++;
            }
        }

        // What is left is a band this destination was priced for before and is priced for no longer. Closed rather
        // than deleted, because it was the price once and an order that shipped under it is still an order. Only
        // this destination's bands are considered, so one the provider left out of its list keeps its last tariff
        // instead of being emptied by a sweep that never asked about it.
        for (ShippingPrice stale : current.values()) {
            stale.setValidTo(sweptAt);
            tally.closed++;
        }

        // Every closure is written before any replacement is. Only one row per band may stand open at a time, and
        // Hibernate flushes its inserts before its updates - so a new price inserted in the same flush that closes
        // the old one would collide with the row it is replacing.
        repository.flush();
        repository.saveAll(opening);
    }

    private Map<String, ShippingPrice> currentByBand(String countryCode) {
        Map<String, ShippingPrice> current = new HashMap<>();
        for (ShippingPrice price : repository
                .findByCountryCodeAndValidToIsNullOrderByShipmentTypeAscServiceAscWeightToGramsAsc(countryCode)) {
            current.put(price.getShipmentType() + "|" + price.getService() + "|" + price.getWeightToGrams(), price);
        }
        return current;
    }

    private static String bandKey(ShippingPriceBand band) {
        return band.getShipmentType() + "|" + band.getService() + "|" + band.getWeightToGrams();
    }

    private static ShippingPrice rowOf(LatvijasPastsCountry country, ShippingPriceBand band, Instant sweptAt) {
        ShippingPrice price = new ShippingPrice();
        price.setCountryCode(country.getCode());
        price.setCountryName(nameOf(country));
        price.setShipmentType(band.getShipmentType());
        price.setService(band.getService());
        price.setWeightFromGrams(band.getWeightFromGrams());
        price.setWeightToGrams(band.getWeightToGrams());
        price.setBasePrice(band.getBasePrice());
        price.setTrackingFee(band.getTrackingFee());
        price.setDeliveryDaysMin(band.getDeliveryDaysMin());
        price.setDeliveryDaysMax(band.getDeliveryDaysMax());
        price.setValidFrom(sweptAt);
        price.setCheckedAt(sweptAt);
        return price;
    }

    /** The destination's name, falling back to its code for one the provider names in neither language. */
    private static String nameOf(LatvijasPastsCountry country) {
        if (country.getName() != null && !country.getName().isBlank()) {
            return country.getName();
        }
        return country.getNameLv() != null && !country.getNameLv().isBlank() ? country.getNameLv() : country.getCode();
    }
}
