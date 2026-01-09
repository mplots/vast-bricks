package com.vastbricks.shipping;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

@Disabled("Calls external Latvijas Pasts API")
class LatvijasPastsClientV2Test {


    @Test
    void getPricesForAllCountries() {
        var clientv2 = new LatvijasPastsClientV2();


        for (var country : Tariff.Country.values()) {
            var tarrif = new Tariff();
            tarrif.setMode(Tariff.Mode.TRACEABLE);
            tarrif.setCountry(country);
            tarrif.setWeight(BigDecimal.valueOf(100));
            tarrif.setType(Tariff.Type.SMALL_PACKAGE);


            var result = clientv2.calculate(tarrif);
            System.out.print(country + "->");
            System.out.println(result.getResult().getAmount());
        }
    }
}
