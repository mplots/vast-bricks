package com.vastbricks.market.owl;

import com.vastbricks.shipping.LatvijasPastsClient;
import com.vastbricks.shipping.Tariff;
import lombok.Builder;
import lombok.Data;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.thymeleaf.util.temporal.TemporalArrayUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

@Disabled
class ShippingTable {

    @Data
    public static final class TableRow {
        private Tariff.Country country;
        private Map<Tariff.Mode, BigDecimal> price;
    }

    @Test
    void createShippingTable() {
        var pasts = new LatvijasPastsClient();
//        var weights = List.of(new BigDecimal("20").setScale(2, RoundingMode.HALF_UP), new BigDecimal("100").setScale(2, RoundingMode.HALF_UP), new BigDecimal("500").setScale(2, RoundingMode.HALF_UP), new BigDecimal("1000").setScale(2, RoundingMode.HALF_UP), new BigDecimal("2000").setScale(2, RoundingMode.HALF_UP));
        var weights = List.of(new BigDecimal("20").setScale(2, RoundingMode.HALF_UP), new BigDecimal("100").setScale(2, RoundingMode.HALF_UP));
        var weightsTariffs = new HashMap<BigDecimal, List<TableRow>>();

//        var countries = List.of(Tariff.Country.AFGHANISTAN); /*Tariff.Country.values();*/
        var countries = Tariff.Country.values();

        for (var weight : weights) {
            var table = new ArrayList<TableRow>();
            weightsTariffs.put(weight, table);

            for (var country : countries) {
                var row = new TableRow();
                row.setCountry(country);
                row.setPrice(new HashMap<>());
                table.add(row);

                for (var mode : Tariff.Mode.values()) {
                    try {
                        var tariff = pasts.calculate(
                            Tariff.builder()
                                .type(Tariff.Type.SMALL_PACKAGE)
                                .group(Tariff.Group.FOREIGN_COUNTRIES)
                                .country(country)
                                .mode(mode)
                                .insuredAmount(mode == Tariff.Mode.INSURED ? new BigDecimal("100") : null)
                                .weight(weight)
                                .mansPasts(true)
                            .build()
                        );

                        var shippingVAT = tariff.getResult().getTrackableVat().divide(new BigDecimal("100")).add(new BigDecimal("1"));
                        var shipping = tariff.getResult().getTrackable();
                        var shippingAndVAT = shipping.multiply(shippingVAT);

                        var insuranceVAT = tariff.getResult().getTrackableVat().divide(new BigDecimal("100")).add(new BigDecimal("1"));
                        var insurance = new BigDecimal("100").multiply(tariff.getResult().getInsurancePrice());
                        var insuranceWithVAT = insurance.multiply(insuranceVAT);

                        if (mode == Tariff.Mode.TRACEABLE) {
                            row.getPrice().put(mode, shippingAndVAT);
                        }else {
                            var price = tariff.getResult().getAmount().add(shippingAndVAT).add(insuranceWithVAT).setScale(2, RoundingMode.HALF_UP);
                            row.getPrice().put(mode, price);
                        }

                    }catch (Exception e) {
                        //Do nothing
                    }
                }
            }
        }

        for (var weight : weightsTariffs.keySet()) {
            var table = weightsTariffs.get(weight);
            System.out.println("=================== " + weight + "g ===================");

            System.out.println("Country, Simple, Traceable, Insured, Recorded");
            for (var row : table) {
                System.out.print(row.country.getTitle() + ",");
                System.out.print(row.price.get(Tariff.Mode.SIMPLE) + ",");
                System.out.print(row.price.get(Tariff.Mode.TRACEABLE) + ",");
                System.out.print(row.price.get(Tariff.Mode.INSURED) + ",");
                System.out.println(row.price.get(Tariff.Mode.RECORDED));
            }

            System.out.println("\n");
        }
    }

}
