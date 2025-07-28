package com.vastbricks.market.owl;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.market.link.Countries;
import com.vastbricks.market.link.LinkClient;
import com.vastbricks.market.link.ShippingMethod;
import com.vastbricks.shipping.LatvijasPastsClient;
import com.vastbricks.shipping.Tariff;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;


@Disabled
@Slf4j
class LinkShipping {

    @Test
    @SneakyThrows
    void updateLatvianPostShipping() {
        var cookie = System.getenv("TEST_LINK_COOKIE");
        var client = new LinkClient(cookie);
        var shippingMethodId = 341503;
        var countries = client.internal().getCountries().getCountries();
//        var countries = new ArrayList<Countries.Country>();
//        countries.add(Countries.Country.builder().
//            strCountryID("PT"). strCountryName("Portugal").n4CurrencyID("2").n4ContinentID("6").strContinentName("Europe").n4BuyerCnt("10270")
//        .build());
//        countries.add(Countries.Country.builder().
//            strCountryID("LV"). strCountryName("Latvia").n4CurrencyID("2").n4ContinentID("6").strContinentName("Europe").n4BuyerCnt("2000")
//        .build());

        var method = client.internal().getShippingMethod(shippingMethodId);
        ShippingMethod.TrackingRule trackingRule = null;
        if (method.getMethod().getTrackingRules() == null) {
            method.getMethod().setTrackingRules(new ArrayList<>());
        }


        var newIdCounter = -method.getMethod().getZones().size();

        for (var country : countries) {
            var oLpCountry = Arrays.stream(Tariff.Country.values()).filter(e-> e.getCode().equals(country.getStrCountryID())).findFirst();
            if (country.getStrCountryID().equals("UK")) {
                oLpCountry = Optional.of(Tariff.Country.UNITED_KINGDOM);
            }
            if(!oLpCountry.isPresent()) {
                log.warn("Not Found - {} ({})", country.getStrCountryName(), country.getStrCountryID());
                continue;
            }

            var zone = method.getMethod().getZones().stream().filter(
                e->e.getCountryList().stream().anyMatch(a->a.getCode().equals(country.getStrCountryID()))
            ).findFirst().orElse(
                ShippingMethod.Zone.builder()
                    .id(--newIdCounter)
                    .action("add")
                    .everywhereElse(false)
                    .countryList(List.of(
                        ShippingMethod.Country.builder()
                            .code(country.getStrCountryID())
                            .buyerCnt(Long.valueOf(country.getN4BuyerCnt()))
                            .continentId(Integer.valueOf(country.getN4ContinentID()))
                            .name(country.getStrCountryName())
                        .build()
                    ))
                .build()
            );
            zone.setName("Latvia".equals(country.getStrCountryName()) ? "Domestic" : country.getStrCountryName());
            zone.setMinDays(5);
            zone.setMaxDays(10);
            if (zone.getId() < 0) {
                method.getMethod().getZones().add(zone);
            }

            var pasts = new LatvijasPastsClient();
            var weights = List.of(new BigDecimal("100").setScale(2, RoundingMode.HALF_UP), new BigDecimal("500").setScale(2, RoundingMode.HALF_UP), new BigDecimal("1000").setScale(2, RoundingMode.HALF_UP), new BigDecimal("2000").setScale(2, RoundingMode.HALF_UP));
                var request = Tariff.builder()
                        .type(Tariff.Type.SMALL_PACKAGE)
                        .group(oLpCountry.get() == Tariff.Country.LATVIA ? Tariff.Group.LATVIA : Tariff.Group.FOREIGN_COUNTRIES)
                        .country(oLpCountry.get())
                        .build();
                var mode = pasts.calculate(request).getData().getModes().stream().anyMatch(e->e.getId().equals(Tariff.Mode.TRACEABLE.getId())) ? Tariff.Mode.TRACEABLE : Tariff.Mode.SIMPLE;
                request.setMode(mode);

            for (var weight : weights) {
                request.setWeight(weight);
                var tariff = pasts.calculate(
                    request
                );
                var price = tariff.getResult().getAmount().setScale(2, RoundingMode.HALF_UP);

                var refTable = method.getMethod().getRateTable().stream().filter(e-> new BigDecimal(e.getUpto()).compareTo(weight) == 0).findFirst().orElseGet(()->{
                    var rate =  ShippingMethod.Rate.builder()
                        .upto(weight.toString())
                        .costs(new ArrayList<>())
                        .action("add")
                    .build();
                    method.getMethod().getRateTable().add(rate);
                    return rate;
                });

                var cost = refTable.getCosts().stream().filter(e->e.getZoneId().equals(zone.getId())).findFirst().orElseGet(()-> {
                    var aCost = ShippingMethod.Cost.builder()
                        .zoneId(zone.getId())
                    .build();
                    refTable.getCosts().add(aCost);
                    return aCost;
                });
                cost.setCost(price);

                // Move level down ?
                if (mode == Tariff.Mode.TRACEABLE) {
                    var trackingVAT = tariff.getResult().getTrackableVat().divide(new BigDecimal("100")).add(new BigDecimal("1"));
                    var tracking = tariff.getResult().getTrackable();
                    var trackingWithVAT = tracking.multiply(trackingVAT).setScale(2, RoundingMode.HALF_UP);

                    trackingRule = method.getMethod().getTrackingRules().stream().filter(e -> e.getArg1().equals(trackingWithVAT.toString())).findFirst().orElseGet(() -> {
                        var aTrackingRule = new ShippingMethod.TrackingRule();
                        aTrackingRule.setArg1(trackingWithVAT.toString());
                        aTrackingRule.setArg2("0.01");
                        aTrackingRule.setType(1);
                        aTrackingRule.setAction("add");
                        method.getMethod().getTrackingRules().add(aTrackingRule);
                        return aTrackingRule;
                    });
                }
            }

            if (mode == Tariff.Mode.TRACEABLE) {
                if (trackingRule.getZones() == null) trackingRule.setZones(new ArrayList<>());
                trackingRule.getZones().add(zone.getId());
            }
        }

        client.internal().updateShippingMethod(shippingMethodId, method);
    }
}
