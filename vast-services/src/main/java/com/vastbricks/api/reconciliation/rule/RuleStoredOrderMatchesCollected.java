package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_BUYER;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_BUYER_USERNAME;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_CURRENCY;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_DATE;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_FACILITATOR_TAX;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_GRAND_TOTAL;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_ITEM_COUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_LOT_COUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_PAYMENT_METHOD;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_REFUNDED_AMOUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_SHIPPING_COST;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_SUB_TOTAL;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_TAX_TYPE;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_BUYER;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_BUYER_USERNAME;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_CURRENCY;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_FACILITATOR_TAX;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_GRAND_TOTAL;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_ITEM_COUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_LOT_COUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_ORDER_DATE;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_PAYMENT_METHOD;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_REFUNDED_AMOUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_SHIPPING_COST;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_SUB_TOTAL;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.STORED_TAX_TYPE;
import static com.vastbricks.api.reconciliation.rule.ReconciliationFailureLevel.WARNING;

import com.vastbricks.api.reconciliation.OrderFields;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationOrderField;
import com.vastbricks.api.reconciliation.StoredFields;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * What the store kept must be what the marketplace still says.
 *
 * <p>The orders table is a copy of the marketplace's own account, imported out of the archive the store took of it.
 * Every other rule here holds two different parties against each other - the marketplace against the payment
 * provider, the order against the invoice written for it - and a disagreement means one of them is wrong about a
 * shared fact. This one holds one party against itself across time, and a disagreement means something else: either
 * the order changed after it was archived, or the archive is being read differently from the way the live collection
 * reads the same marketplace.
 *
 * <p>Both are worth knowing and neither is an error to go and fix, which is why every mismatch is a warning rather
 * than an error: nothing is broken, two accounts of one order have drifted, and a person is the right judge of
 * which one to believe.
 *
 * <p>One failure per field rather than one per order, each citing the pair that disagreed, so a screen can say which
 * field drifted and show both values. An order nothing was stored for is not compared at all and reports nothing:
 * an order placed since the last import has not drifted, it has not been imported, and the empty stored columns
 * beside the row already say so.
 */
final class RuleStoredOrderMatchesCollected {

    /** One field, named on both sides and read from both, so a comparison states itself in one line. */
    @Getter
    @AllArgsConstructor
    static final class Compared<T> {

        private final ReconciliationOrderField collectedField;

        private final ReconciliationOrderField storedField;

        private final Function<OrderFields, T> collected;

        private final Function<StoredFields, T> stored;
    }

    /**
     * Every field the orders table stores that the live collection also states.
     *
     * <p>The identity of the order is not here: the marketplace and the order id are what the two accounts were
     * paired by, so comparing them could only ever agree. Nor is the order's address, which is derived from that id
     * on both sides.
     */
    static final List<Compared<?>> COMPARED = List.of(
            new Compared<>(ORDER_DATE, STORED_ORDER_DATE, OrderFields::getOrderDate, StoredFields::getOrderDate),
            new Compared<>(ORDER_BUYER, STORED_BUYER, OrderFields::getBuyer, StoredFields::getBuyer),
            new Compared<>(ORDER_BUYER_USERNAME, STORED_BUYER_USERNAME, OrderFields::getBuyerUsername, StoredFields::getBuyerUsername),
            new Compared<>(ORDER_ITEM_COUNT, STORED_ITEM_COUNT, OrderFields::getItemCount, StoredFields::getItemCount),
            new Compared<>(ORDER_LOT_COUNT, STORED_LOT_COUNT, OrderFields::getLotCount, StoredFields::getLotCount),
            new Compared<>(ORDER_PAYMENT_METHOD, STORED_PAYMENT_METHOD, OrderFields::getPaymentMethod, StoredFields::getPaymentMethod),
            new Compared<>(ORDER_CURRENCY, STORED_CURRENCY, OrderFields::getCurrency, StoredFields::getCurrency),
            new Compared<>(ORDER_TAX_TYPE, STORED_TAX_TYPE, OrderFields::getTaxType, StoredFields::getTaxType),
            new Compared<>(ORDER_FACILITATOR_TAX, STORED_FACILITATOR_TAX, OrderFields::getFacilitatorTax, StoredFields::getFacilitatorTax),
            new Compared<>(ORDER_SUB_TOTAL, STORED_SUB_TOTAL, OrderFields::getSubTotal, StoredFields::getSubTotal),
            new Compared<>(ORDER_SHIPPING_COST, STORED_SHIPPING_COST, OrderFields::getShippingCost, StoredFields::getShippingCost),
            new Compared<>(ORDER_GRAND_TOTAL, STORED_GRAND_TOTAL, OrderFields::getGrandTotal, StoredFields::getGrandTotal),
            new Compared<>(ORDER_REFUNDED_AMOUNT, STORED_REFUNDED_AMOUNT, OrderFields::getRefundedAmount, StoredFields::getRefundedAmount)
    );

    static final String STORED_FIELD_MISMATCH = "stored-field-mismatch";

    private RuleStoredOrderMatchesCollected() {
    }

    /** Every field of this order the stored copy disagrees with, in the order the fields are declared in. */
    static List<ReconciliationFailure> mismatches(ReconciledOrder order) {
        if (!order.getStored().isPresent()) {
            return List.of();
        }
        var failures = new ArrayList<ReconciliationFailure>();
        for (Compared<?> compared : COMPARED) {
            if (!agrees(compared, order)) {
                failures.add(new ReconciliationFailure(
                        STORED_FIELD_MISMATCH,
                        WARNING,
                        List.of(compared.getCollectedField(), compared.getStoredField())
                ));
            }
        }
        return List.copyOf(failures);
    }

    /**
     * Whether both accounts say the same thing about one field.
     *
     * <p>Only where both of them say something. A field one side states and the other does not is a difference in
     * what was collected rather than a drift in what the order is: the two accounts do not read the same files.
     * The live collection asks BrickLink for the buyer username in an export of its own, which the archive never
     * kept, and the stored copy types an order for tax out of an accounting export the live side may have been
     * refused. Reporting those as disagreements would put a warning on every order the moment one fetch came back
     * empty, and say nothing about any of them.
     *
     * <p>An amount is compared by value rather than by {@code equals}, so {@code 2.5} and {@code 2.50} agree: one
     * amount written two ways, and a scale a provider happened to send is not a disagreement.
     */
    private static boolean agrees(Compared<?> compared, ReconciledOrder order) {
        Object collected = compared.getCollected().apply(order.getOrder());
        Object stored = compared.getStored().apply(order.getStored());
        if (collected == null || stored == null) {
            return true;
        }
        if (collected instanceof BigDecimal left && stored instanceof BigDecimal right) {
            return left.compareTo(right) == 0;
        }
        return Objects.equals(collected, stored);
    }
}
