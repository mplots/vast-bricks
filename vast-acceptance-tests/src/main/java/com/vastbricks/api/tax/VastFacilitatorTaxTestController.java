package com.vastbricks.api.tax;

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
 * Reaches {@link FacilitatorTaxes} for logic tests, the way {@link OrderTaxTypes} is reached: one mapping per
 * marketplace taking exactly the fields that marketplace states, and a parameter left out is a field it did not
 * report. The amount depends on the order's tax type, so a mapping takes the fields that decide the type as well as
 * the ones that state the tax.
 */
@RestController
@RequestMapping(path = "/api/test/facilitator-tax", produces = MediaType.APPLICATION_JSON_VALUE)
class VastFacilitatorTaxTestController {

    @GetMapping("/brickowl")
    Map<String, BigDecimal> ofBrickOwlOrder(
            @RequestParam(name = "billingCountryCode", required = false) String billingCountryCode,
            @RequestParam(name = "taxSchemeId", required = false) String taxSchemeId,
            @RequestParam(name = "taxRate", required = false) BigDecimal taxRate,
            @RequestParam(name = "taxAmount", required = false) BigDecimal taxAmount
    ) {
        var order = new BrickOwlOrder();
        order.setBillingCountryCode(billingCountryCode);
        order.setTaxSchemeId(taxSchemeId);
        order.setTaxRate(taxRate);
        order.setTaxAmount(taxAmount);
        return facilitatorTax(FacilitatorTaxes.of(order));
    }

    @GetMapping("/bricklink")
    Map<String, BigDecimal> ofBrickLinkOrder(
            @RequestParam(name = "location", required = false) String location,
            @RequestParam(name = "vatCharges", required = false) BigDecimal vatCharges,
            @RequestParam(name = "salesTax", required = false) BigDecimal salesTax,
            @RequestParam(name = "vat", required = false) BigDecimal vat
    ) {
        var order = new BrickStoreOrder();
        order.setLocation(location);
        order.setVatCharges(vatCharges);
        order.setSalesTax(salesTax);
        order.setVat(vat);
        return facilitatorTax(FacilitatorTaxes.of(order));
    }

    /** No facilitator tax is the answer, not a missing one, so it is reported as a null value rather than no body. */
    private Map<String, BigDecimal> facilitatorTax(BigDecimal facilitatorTax) {
        return Collections.singletonMap("facilitatorTax", facilitatorTax);
    }
}
