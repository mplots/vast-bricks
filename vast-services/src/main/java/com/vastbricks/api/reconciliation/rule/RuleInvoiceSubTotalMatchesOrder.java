package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.INVOICE_SUB_TOTAL;
import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.ITEMS_SUB_TOTAL;
import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.SUB_TOTAL;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * An order must have an accounting invoice whose sub-total equals both the order's own sub-total and the sum of its
 * item prices. Orders placed before invoicing started are not invoiced at all, so the rule does not apply to them.
 */
@Component
class RuleInvoiceSubTotalMatchesOrder implements Rule {

    /** First day orders are invoiced. Earlier orders legitimately have no accounting invoice. */
    private static final LocalDate INVOICED_FROM = LocalDate.of(2026, 9, 1);

    private static final String AMOUNT_MISSING = "amount-missing";
    private static final String INVOICE_SUB_TOTAL_MISMATCH = "invoice-sub-total-mismatch";
    private static final String INVOICE_ITEMS_SUB_TOTAL_MISMATCH = "invoice-items-sub-total-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (order.getOrderDate() == null || order.getOrderDate().isBefore(INVOICED_FROM)) {
            return List.of();
        }

        var invoiceSubTotal = order.getInvoiceSubTotal();
        if (invoiceSubTotal == null) {
            return List.of(new ReconciliationFailure(AMOUNT_MISSING, List.of(INVOICE_SUB_TOTAL)));
        }

        // A missing order amount is already reported by the rule that owns it, so it is not repeated here.
        var failures = new ArrayList<ReconciliationFailure>();
        if (differs(invoiceSubTotal, order.getSubTotal())) {
            failures.add(new ReconciliationFailure(INVOICE_SUB_TOTAL_MISMATCH, List.of(INVOICE_SUB_TOTAL, SUB_TOTAL)));
        }
        if (differs(invoiceSubTotal, order.getItemsSubTotal())) {
            failures.add(new ReconciliationFailure(
                    INVOICE_ITEMS_SUB_TOTAL_MISMATCH,
                    List.of(INVOICE_SUB_TOTAL, ITEMS_SUB_TOTAL)
            ));
        }
        return List.copyOf(failures);
    }

    private boolean differs(BigDecimal invoiceSubTotal, BigDecimal orderAmount) {
        return orderAmount != null && invoiceSubTotal.compareTo(orderAmount) != 0;
    }
}
