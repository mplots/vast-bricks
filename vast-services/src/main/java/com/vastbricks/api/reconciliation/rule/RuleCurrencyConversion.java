package com.vastbricks.api.reconciliation.rule;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import org.springframework.stereotype.Component;

/** Unavailable conversions are errors, never evidence of a zero refund or tax. */
@Component
class RuleCurrencyConversion implements Rule {
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        return order.isCurrencyConversionMissing()
                ? List.of(new ReconciliationFailure("currency-conversion-missing", ReconciliationFailureLevel.ERROR, List.of()))
                : List.of();
    }
}
