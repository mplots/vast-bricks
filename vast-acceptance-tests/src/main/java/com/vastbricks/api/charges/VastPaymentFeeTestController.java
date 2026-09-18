package com.vastbricks.api.charges;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reaches {@link PaymentFees} for logic tests: unlike {@link MarketplaceFees}, it takes no marketplace order at all,
 * only the payment method and grand total a scenario states directly.
 */
@RestController
@RequestMapping(path = "/api/test/payment-fee", produces = MediaType.APPLICATION_JSON_VALUE)
class VastPaymentFeeTestController {

    @GetMapping
    Map<String, BigDecimal> of(
            @RequestParam(name = "paymentMethod", required = false) String paymentMethod,
            @RequestParam(name = "grandTotal", required = false) BigDecimal grandTotal
    ) {
        return Collections.singletonMap("paymentFee", PaymentFees.of(paymentMethod, grandTotal));
    }
}
