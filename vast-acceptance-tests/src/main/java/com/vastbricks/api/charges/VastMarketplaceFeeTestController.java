package com.vastbricks.api.charges;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reaches {@link MarketplaceFees} for logic tests, the way {@link FacilitatorTaxes} is reached: one mapping per
 * marketplace taking exactly the fields that marketplace states, and a parameter left out is a field it did not
 * report.
 */
@RestController
@RequestMapping(path = "/api/test/marketplace-fee", produces = MediaType.APPLICATION_JSON_VALUE)
class VastMarketplaceFeeTestController {

    @GetMapping("/brickowl")
    Map<String, BigDecimal> ofBrickOwlOrder(
            @RequestParam(name = "billingCountryCode", required = false) String billingCountryCode,
            @RequestParam(name = "taxSchemeId", required = false) String taxSchemeId,
            @RequestParam(name = "taxRate", required = false) BigDecimal taxRate,
            @RequestParam(name = "taxAmount", required = false) BigDecimal taxAmount,
            @RequestParam(name = "shipping", required = false) BigDecimal shipping,
            @RequestParam(name = "baseOrderTotal", required = false) BigDecimal baseOrderTotal
    ) {
        var order = new BrickOwlOrder();
        order.setBillingCountryCode(billingCountryCode);
        order.setTaxSchemeId(taxSchemeId);
        order.setTaxRate(taxRate);
        order.setTaxAmount(taxAmount);
        order.setShipping(shipping);
        order.setBaseOrderTotal(baseOrderTotal);
        return marketplaceFee(MarketplaceFees.of(order));
    }

    @GetMapping("/bricklink")
    Map<String, BigDecimal> ofBrickLinkOrder(
            @RequestParam(name = "baseGrandTotal", required = false) BigDecimal baseGrandTotal
    ) {
        var order = new BrickStoreOrder();
        order.setBaseGrandTotal(baseGrandTotal);
        return marketplaceFee(MarketplaceFees.of(order));
    }

    /** No marketplace fee is the answer, not a missing one, so it is reported as a null value rather than no body. */
    private Map<String, BigDecimal> marketplaceFee(BigDecimal marketplaceFee) {
        return Collections.singletonMap("marketplaceFee", marketplaceFee);
    }
}
