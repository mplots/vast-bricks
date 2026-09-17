package com.vastbricks.api.shippingprice;

import com.vastbricks.api.shippingprice.ShippingPricePayload.CountryPricesResponse;
import com.vastbricks.api.shippingprice.ShippingPricePayload.CountryResponse;
import com.vastbricks.api.shippingprice.ShippingPricePayload.PriceResponse;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reading the tariff table. Every answer is the current prices; history is kept but is not what a screen asks for. */
@Service
@RequiredArgsConstructor
class ShippingPriceService {

    private final ShippingPriceRepository repository;

    @Transactional(readOnly = true)
    List<CountryResponse> findCountries() {
        return repository.findDistinctByValidToIsNullOrderByCountryNameAsc().stream()
                .map(country -> new CountryResponse(country.getCountryCode(), country.getCountryName()))
                .toList();
    }

    /**
     * One destination's current prices, or an answer with no prices in it for a destination there are none for.
     *
     * <p>Not a 404: a destination the provider has stopped pricing is a real question with an empty answer, and the
     * screen says so better than an error does.
     */
    @Transactional(readOnly = true)
    CountryPricesResponse findPrices(String countryCode) {
        List<ShippingPrice> prices =
                repository.findByCountryCodeAndValidToIsNullOrderByShipmentTypeAscServiceAscWeightToGramsAsc(
                        countryCode
                );

        String name = prices.isEmpty() ? countryCode : prices.get(0).getCountryName();
        Instant checkedAt = prices.stream()
                .map(ShippingPrice::getCheckedAt)
                .min(Comparator.naturalOrder())
                .orElse(null);

        return new CountryPricesResponse(countryCode, name, checkedAt, prices.stream().map(
                price -> new PriceResponse(
                        price.getShipmentType(),
                        price.getService(),
                        price.getWeightFromGrams(),
                        price.getWeightToGrams(),
                        price.getBasePrice(),
                        price.getTrackingFee(),
                        price.totalPrice(),
                        price.getCurrency(),
                        price.getDeliveryDaysMin(),
                        price.getDeliveryDaysMax(),
                        price.getValidFrom()
                )
        ).toList());
    }
}
