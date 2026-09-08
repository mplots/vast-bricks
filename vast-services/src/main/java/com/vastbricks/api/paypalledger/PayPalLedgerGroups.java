package com.vastbricks.api.paypalledger;

import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.client.paypal.PayPalTransactionInfo;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;

/**
 * Which transactions of a period are one transaction.
 *
 * <p>PayPal reports what a reader thinks of as a single payment as several balance-affecting transactions: the
 * payment itself, the fee the marketplace took as partner, and the conversions that moved it into the balance's own
 * currency. Its own interface shows them under one transaction, and the ledger screen has to as well — two rows a
 * reader has no way of telling belong together read as two payments.
 *
 * <p>What ties them is {@code paypal_reference_id}: a commission or a conversion names the transaction it was
 * raised against. Two things have to be true of a record before it reads under another one, and both matter.
 *
 * <p>It has to name a <em>collected</em> record. PayPal writes a payment's own base id into the same field — the
 * checkout it came from, which is not a transaction of the ledger at all — and a reference naming nothing in the
 * period is not a grouping either: a commission raised against last month's payment stands alone rather than
 * pulling a month it cannot see into this one.
 *
 * <p>And it has to be something a transaction's own account can state: a deduction, or a leg of a conversion. That
 * is the harder half, and it was learned the hard way. Plenty of records name a transaction without being part of
 * it — a refund names the payment it reverses, and it is money going back out on a day of its own, weeks later,
 * which no account of the payment has a line for. Grouping by the reference alone folded such a record away into a
 * transaction whose figures said nothing about it, and its money simply left the ledger: a month's net movement came
 * out over by exactly the refund. So the rule is not "what points at this" but "what this transaction is made of",
 * and a record the transaction is not made of stays a transaction of the period, however plainly it names another
 * one.
 *
 * <p>The chain is followed to its head rather than one hop, so a conversion raised against a fee reads under the
 * payment they both belong to. A reference that comes back round to where it started is not a group and is left
 * heading itself: a cycle would otherwise be walked forever.
 */
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
final class PayPalLedgerGroups {

    /** The transaction each collected id reads under, its own included. */
    private final Map<String, String> headById;

    static PayPalLedgerGroups of(List<PayPalTransaction> transactions) {
        Map<String, String> referenceById = new HashMap<>();
        for (var transaction : transactions) {
            var info = transaction.getTransactionInfo();
            if (info == null) {
                continue;
            }
            var id = trimmed(info.getTransactionId());
            // First one wins, as everywhere a payment is matched: a provider repeating an id is reporting one
            // transaction twice rather than two. A record that is no part of another transaction's account is
            // entered as naming nothing, so nothing can read under it and it reads under nothing.
            if (id != null && !referenceById.containsKey(id)) {
                referenceById.put(id, partOfATransaction(info) ? trimmed(info.getPayPalReferenceId()) : null);
            }
        }

        Map<String, String> headById = new HashMap<>();
        for (var id : referenceById.keySet()) {
            headById.put(id, headOf(id, referenceById));
        }
        return new PayPalLedgerGroups(headById);
    }

    /** The transaction this one reads under: the head of its group, or itself when it heads one. */
    String headOf(String id) {
        return id == null ? null : headById.getOrDefault(id, id);
    }

    private static String headOf(String id, Map<String, String> referenceById) {
        var seen = new HashSet<String>();
        var current = id;
        while (seen.add(current)) {
            var reference = referenceById.get(current);
            if (reference == null || !referenceById.containsKey(reference)) {
                return current;
            }
            current = reference;
        }
        // A reference that came back round to where it started names no head, so the transaction keeps its own.
        return id;
    }

    /**
     * Whether a record is something a transaction's own account states, and can therefore read under one.
     *
     * <p>The deductions it names and the legs of the conversion it ends on, and nothing else. Everything PayPal
     * raises against a transaction that its account has no line for is a movement of the account in its own right.
     */
    private static boolean partOfATransaction(PayPalTransactionInfo info) {
        var eventCode = trimmed(info.getTransactionEventCode());
        return eventCode != null
                && (PayPalLedgerService.DEDUCTION_EVENT_CODES.contains(eventCode)
                        || PayPalLedgerConversion.CONVERSION_EVENT_CODE.equals(eventCode));
    }

    private static String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
