package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.ledger.bank.BankTransfer;
import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Merges what the bank shows was transferred for an order onto that order. For an order settled by bank transfer the
 * bank is the payment provider, so what it booked is collected under the gateway source exactly as a card provider's
 * payment is, and the rules holding a payment against an order need to know nothing about where it came from.
 *
 * <p>This is one mapper rather than one per marketplace, unlike the provider payment mappers, because a bank entry
 * names no marketplace: it carries free text a payer wrote. A mapper per marketplace would have each of them
 * guessing at the other's orders, so the text is read against every collected order instead, and only against those
 * the marketplace says were paid by bank transfer.
 *
 * <p>An order is matched by the order id the entry names, and by nothing else in this iteration. The mapping a
 * person wrote is read first, being the manual last resort and therefore the one thing that must not be overridden
 * by what a payer happened to type; failing that, the payer's own remittance information is read. Text naming two
 * collected orders names neither: a guessed payment would read exactly like a reconciled one. Matching a buyer by
 * name, as the PayPal BrickLink mapper does, is deliberately not attempted here yet.
 *
 * <p>Every entry naming one order is summed rather than the first one winning, which is where this departs from the
 * provider mappers. A buyer who underpaid and was asked for the rest made two transfers for one order, and both are
 * money the store received; a card payment, by contrast, is one authorization of one amount.
 *
 * <p>A debit naming the order is money that went back out, so it is summed as the gateway's refunded amount. The
 * gateway's facilitator tax stays absent because a bank deducts none, and there is no payment link: a bank has no
 * page to open the transfer at, so the screen shows the payment method as the plain value it is.
 */
@Component
@Order(7)
class MapperBankTransfers implements DetailMapper<BankTransfer> {

    @Override
    public Class<BankTransfer> type() {
        return BankTransfer.class;
    }

    @Override
    public void map(List<BankTransfer> sourced, ReconciledOrders orders) {
        // Identity, not equality: two collected orders may state the same fields, and each is settled on its own.
        Map<ReconciledOrder, Settlement> settled = new IdentityHashMap<>();
        for (var transfer : sourced) {
            var order = namedOrder(transfer, orders);
            if (order != null) {
                settled.computeIfAbsent(order, ignored -> new Settlement()).add(transfer);
            }
        }
        settled.forEach((order, settlement) -> settlement.mergeOnto(order));
    }

    /** The one bank-transfer order this entry names, or {@code null} when its text names none or several. */
    private ReconciledOrder namedOrder(BankTransfer transfer, ReconciledOrders orders) {
        var mapped = bankTransferOrders(orders.findNamedIn(transfer.getMapping()));
        if (!mapped.isEmpty()) {
            return mapped.size() == 1 ? mapped.getFirst() : null;
        }
        var remitted = bankTransferOrders(orders.findNamedIn(transfer.getRemittanceInformation()));
        return remitted.size() == 1 ? remitted.getFirst() : null;
    }

    private static List<ReconciledOrder> bankTransferOrders(List<ReconciledOrder> orders) {
        return orders.stream().filter(BankPayments.PAID_BY_BANK_TRANSFER).toList();
    }

    /** What one order's own entries came to, each way, and which entries those were. */
    private static final class Settlement {

        private BigDecimal paid;
        private BigDecimal refunded;
        private final List<String> references = new ArrayList<>();

        void add(BankTransfer transfer) {
            // Named whichever way it went: a refund is as much this order's entry as the payment it came out of, and
            // the screen draws the link to both.
            if (transfer.getEntryReference() != null) {
                references.add(transfer.getEntryReference());
            }
            if (BankPayments.isCredit(transfer)) {
                paid = sum(paid, transfer.getAmount());
            } else if (BankPayments.isDebit(transfer)) {
                refunded = sum(refunded, transfer.getAmount());
            }
        }

        void mergeOnto(ReconciledOrder order) {
            // Absent rather than zero on either side: no entry either way is the bank saying nothing about it, which
            // is a different fact from a transfer of nothing.
            if (paid != null) {
                order.getGateway().setPaidAmount(ReconciliationAmount.normalize(paid));
            }
            if (refunded != null) {
                order.getGateway().setRefundedAmount(ReconciliationAmount.normalize(refunded));
            }
            order.getGateway().getEntryReferences().addAll(references);
        }

        private static BigDecimal sum(BigDecimal running, BigDecimal amount) {
            if (amount == null) {
                return running;
            }
            return running == null ? amount : running.add(amount);
        }
    }
}
