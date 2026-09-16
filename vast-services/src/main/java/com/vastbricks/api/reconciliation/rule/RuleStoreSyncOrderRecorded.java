package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORE_SYNC_ORDER;
import static com.vastbricks.api.reconciliation.rule.ReconciliationFailureLevel.ERROR;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Every order must have reached the store synchronization.
 *
 * <p>BrickSync is what takes the stock an order sold off the store's other marketplace. An order it holds no record
 * of is an order that was never taken off the other one, which is how the same brick comes to be sold twice, so it
 * is reported at {@code error}: there is something to go and do about it.
 *
 * <p>What there is to do is usually one thing. Orders go missing here in runs rather than singly, because the
 * ordinary cause is that BrickSync was not running at the time - it synchronizes as orders arrive, and an order
 * placed while it is down is an order it never hears about. So a report showing this on more than one order is first
 * a reason to go and check that BrickSync is up, before it is a reason to look at any of the orders. Checking that
 * is a person's job: nothing here watches the process, and a rule that claimed to would be reporting on a program it
 * cannot see.
 *
 * <p>The rule applies to every collected order of either marketplace. BrickSync synchronizes both, and its record is
 * named after the marketplace and the order id exactly as the order archive names one, so there is no order it is
 * silent about by design.
 */
@Component
class RuleStoreSyncOrderRecorded implements Rule {

    private static final String STORE_SYNC_ORDER_MISSING = "store-sync-order-missing";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (Boolean.TRUE.equals(order.getStoreSync().getOrder())) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(STORE_SYNC_ORDER_MISSING, ERROR, List.of(STORE_SYNC_ORDER)));
    }
}
