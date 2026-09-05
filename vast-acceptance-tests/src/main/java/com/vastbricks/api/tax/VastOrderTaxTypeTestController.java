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
 * Reaches {@link OrderTaxTypes} for logic tests. No endpoint exposes the tax type on its own, and the classification
 * is decided by a marketplace's own fields, so there is one mapping per marketplace taking exactly the fields that
 * marketplace states. A parameter left out is the field the marketplace did not report.
 */
@RestController
@RequestMapping(path = "/api/test/order-tax-type", produces = MediaType.APPLICATION_JSON_VALUE)
class VastOrderTaxTypeTestController {

    @GetMapping("/brickowl")
    Map<String, OrderTaxType> ofBrickOwlOrder(
            @RequestParam(name = "billingCountryCode", required = false) String billingCountryCode,
            @RequestParam(name = "taxSchemeId", required = false) String taxSchemeId,
            @RequestParam(name = "taxRate", required = false) BigDecimal taxRate
    ) {
        var order = new BrickOwlOrder();
        order.setBillingCountryCode(billingCountryCode);
        order.setTaxSchemeId(taxSchemeId);
        order.setTaxRate(taxRate);
        return taxType(OrderTaxTypes.of(order));
    }

    @GetMapping("/bricklink")
    Map<String, OrderTaxType> ofBrickLinkOrder(
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
        return taxType(OrderTaxTypes.of(order));
    }

    /** An untyped order is the answer, not a missing one, so it is reported as a null value rather than no body. */
    private Map<String, OrderTaxType> taxType(OrderTaxType taxType) {
        return Collections.singletonMap("taxType", taxType);
    }
}
