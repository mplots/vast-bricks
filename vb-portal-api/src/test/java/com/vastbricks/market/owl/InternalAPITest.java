package com.vastbricks.market.owl;

import com.vastbricks.shipping.LatvijasPastsClient;
import com.vastbricks.shipping.Tariff;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Disabled
class InternalAPITest {

    @Test
    void testGet() {
        var owl = new OwlClient("", "");
        var method = owl.internal().getShippingMethod(114307l);
        System.out.println(method);
    }

    @Test
    public void testList() {
        var owl = new OwlClient("", "");
        var list = owl.internal().listShippingMethods();
        System.out.println(list);
    }


    @Test
    public void testDelete(){
        var owl = new OwlClient("", "");
        owl.internal().deleteShippingMethod("Latvian Post (Slovenia)");
    }

    @Test
    public void testUpdate() {
        var owl = new OwlClient("", "");
        owl.internal().updateShippingMethod(ShippingMethodDetails.builder()
                .id(114307l)
                .share(false)
                .enabled(true)
                .requirePhone(false)
                .expedited(false)
                .dontDefault(false)
                .name("Latvian Post (Austria)")
                .countries(List.of(Country.AUSTRIA))
                .enabled(true)
                .carrierId(195l)
                .carrierName("Latvijas Pasts")
                .note("")
                .initialWeightFrom(BigDecimal.ZERO)
                .restrictions(ShipmentDimensions.builder().build())
                .pricing(List.of(
                        ShipmentPricing.builder()
                                .weightTo(new BigDecimal(20))
                                .price(new BigDecimal("4.03"))
                        .build(),
                        ShipmentPricing.builder()
                                .weightTo(new BigDecimal(100))
                                .price(new BigDecimal("4.33"))
                        .build(),
                        ShipmentPricing.builder()
                                .weightTo(new BigDecimal(500))
                                .price(new BigDecimal("5.71"))
                        .build(),
                        ShipmentPricing.builder()
                                .weightTo(new BigDecimal(1000))
                                .price(new BigDecimal("6.98"))
                        .build(),
                        ShipmentPricing.builder()
                                .weightTo(new BigDecimal(2000))
                                .price(new BigDecimal("9.03"))
                        .build()
                    ))
                .build()
        , false);
    }

    @Test
    public void testCreateShippingMethod() {
        var mode = Tariff.Mode.SIMPLE;
        var owl = new OwlClient("", "");
        var pasts = new LatvijasPastsClient();
        var weights = List.of(new BigDecimal("100").setScale(2, RoundingMode.HALF_UP), new BigDecimal("500").setScale(2, RoundingMode.HALF_UP), new BigDecimal("1000").setScale(2, RoundingMode.HALF_UP), new BigDecimal("2000").setScale(2, RoundingMode.HALF_UP));

        var existingMethods = owl.internal().listShippingMethods();

        for (var country : Tariff.Country.values()) {
            try {
                var pricing = new ArrayList<ShipmentPricing>();
                for (var weight : weights) {


                    var tariff = pasts.calculate(
                            Tariff.builder()
                                    .type(Tariff.Type.SMALL_PACKAGE)
                                    .group(Tariff.Group.FOREIGN_COUNTRIES)
                                    .country(country)
                                    .mode(mode)
                                    .weight(weight)
                                    .build()
                    );

                    var vat = tariff.getResult().getTrackableVat().divide(new BigDecimal("100")).add(new BigDecimal("1"));
                    var shipping = tariff.getResult().getTrackable();
                    var shippingAndVat = shipping.multiply(vat);
                    var price = tariff.getResult().getAmount().add(shippingAndVat).setScale(2, RoundingMode.HALF_UP);

                    pricing.add(
                            ShipmentPricing.builder()
                                    .weightTo(tariff.getResult().getWeightTo().setScale(2, RoundingMode.HALF_UP))
                                    .price(price.add(new BigDecimal("0.35")/* PayPal Static Fee */))
                                    .build()
                    );
                }
                var owlCountry = Arrays.stream(Country.values()).filter(e->e.getCode().equals(country.getCode())).findFirst().get();
                var name = "Latvian Post - %s - %s".formatted(owlCountry.getName(), mode.getName());

                var exiting = existingMethods.stream().filter(e->e.getName().equals(name)).findFirst();
                var details = ShippingMethodDetails.builder()
                        .share(false)
                        .enabled(true)
                        .requirePhone(false)
                        .expedited(false)
                        .dontDefault(false)
                        .name(name)
                        .countries(List.of(owlCountry))
                        .enabled(true)
                        .carrierId(195l)
                        .enabled(true)
                        .carrierId(195l)
                        .carrierName("Latvijas Pasts")
                        .note("")
                        .restrictions(ShipmentDimensions.builder().build())
                        .initialWeightFrom(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                        .pricing(pricing)
                        .build();

                if (exiting.isPresent()) {
                    details.setId(exiting.get().getId());
                    details.setName(name);
                    owl.internal().updateShippingMethod(details, false);
                } else {
                    owl.internal().createShippingMethod(details);
                }
            } catch (Exception e) {
                //Do nothing
            }
        }


    }
}
