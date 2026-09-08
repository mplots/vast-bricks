package com.vastbricks.api.ledger.paypal;

import com.vastbricks.api.client.paypal.PayPalTransaction;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * The currency a transaction is stated in, once PayPal has converted it.
 *
 * <p>A payment taken in a currency the balance is not held in does not stay in that currency. PayPal raises a pair of
 * conversion records against it — one taking the whole of it back out of the currency it arrived in, one putting the
 * result into the balance's own — and it is the second of those that the account actually moved by. A ledger read
 * against a bank statement has to state that one: a row in the currency the money passed through for a moment
 * matches nothing in the bank, and its own currency's figures cancel to nothing anyway.
 *
 * <p>So a converted transaction is stated in the currency it was converted into. The net is what PayPal put there,
 * which is a figure PayPal stated rather than one worked out. The gross is the transaction's own gross at the rate
 * the conversion itself implies — what came back out of the old currency against what went into the new — because a
 * gross in one currency beside a net in another would be a row that does not add up. Everything between them is the
 * fee, which is what the fee column already means: everything that came off, whoever took it and whichever side of
 * the conversion they took it on.
 *
 * <p>Nothing here is guessed. The rate is PayPal's own, read off the two legs it reported, and the net is PayPal's
 * own figure; only the gross is carried across, and it is carried across by the rate PayPal used. Where the rate
 * cannot be read — PayPal reported a leg into a new currency but none out of the old — the transaction is stated at
 * what landed and no fee, rather than at a rate nobody stated.
 */
@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
final class PayPalLedgerConversion {

    /** PayPal's own code for a currency conversion. Both legs of a conversion are reported under it. */
    static final String CONVERSION_EVENT_CODE = "T0200";

    /** Enough places that the rate is exact for any amount a transaction is likely to carry. */
    private static final int RATE_SCALE = 12;

    private static final int SCALE = 2;

    private final String currency;

    /** Signed, as an account's own lines are; the caller states it unsigned with a direction beside it. */
    private final BigDecimal amount;

    private final BigDecimal fee;
    private final BigDecimal net;

    /**
     * What the conversion took back out of the currency PayPal reported the transaction in, or {@code null} where
     * PayPal converted nothing. It is the line that carries the transaction's own account over to this one, so the
     * detail view states it where PayPal's own account of the transaction ends.
     */
    private final BigDecimal withdrawn;


    /**
     * How the transaction is stated: in the currency it was converted into where PayPal converted it, and as it was
     * reported where PayPal did not.
     *
     * @param currency the currency PayPal reported the transaction itself in
     * @param gross what the transaction moved in that currency, signed
     * @param fee everything that came off it in that currency, signed, or {@code null} where nothing did
     * @param lines the records PayPal raised against the transaction
     */
    static PayPalLedgerConversion of(
            String currency,
            BigDecimal gross,
            BigDecimal fee,
            List<PayPalTransaction> lines
    ) {
        var stated = new PayPalLedgerConversion(currency, gross, fee, add(gross, fee), null);

        Set<String> targets = new LinkedHashSet<>();
        for (var line : lines) {
            if (isConversion(line) && currencyOf(line) != null && !currencyOf(line).equals(currency)) {
                targets.add(currencyOf(line));
            }
        }
        // One currency or none. A transaction PayPal converted into two would have no one currency to be stated in,
        // so it is left as PayPal reported it and its legs are read in its detail.
        if (targets.size() != 1) {
            return stated;
        }
        var target = targets.iterator().next();

        // What PayPal put into the new currency, and what it took back out of the old. The deductions raised in the
        // new currency belong to the net as much as the leg does: they came off the same money.
        BigDecimal landed = null;
        BigDecimal withdrawn = null;
        for (var line : lines) {
            var lineCurrency = currencyOf(line);
            var lineAmount = amountOf(line);
            if (lineAmount == null) {
                continue;
            }
            if (target.equals(lineCurrency)) {
                landed = add(landed, lineAmount);
            } else if (isConversion(line) && lineCurrency != null && lineCurrency.equals(currency)) {
                withdrawn = add(withdrawn, lineAmount);
            }
        }
        if (landed == null) {
            return stated;
        }

        var rate = rate(withdrawn, landed);
        var converted = convert(gross, rate);
        return new PayPalLedgerConversion(
                target,
                // At what landed where there was no rate to carry the gross across by, which leaves the transaction
                // stating what PayPal stated and nothing worked out from a rate nobody reported.
                converted == null ? landed : converted,
                // Everything between the gross and what landed, which is every deduction of both currencies and the
                // rounding of the conversion itself. Nothing between them is no fee rather than a fee of zero.
                converted == null || landed.compareTo(converted) == 0 ? null : landed.subtract(converted),
                landed,
                withdrawn
        );
    }

    /** The rate PayPal's own two legs imply, or {@code null} where only one of them was reported. */
    private static BigDecimal rate(BigDecimal withdrawn, BigDecimal landed) {
        if (withdrawn == null || withdrawn.signum() == 0) {
            return null;
        }
        return landed.abs().divide(withdrawn.abs(), RATE_SCALE, RoundingMode.HALF_UP);
    }

    /** The transaction's gross in the currency it was converted into, or {@code null} where there is no rate. */
    private static BigDecimal convert(BigDecimal gross, BigDecimal rate) {
        if (gross == null || rate == null) {
            return null;
        }
        return gross.multiply(rate).setScale(SCALE, RoundingMode.HALF_UP);
    }

    private static boolean isConversion(PayPalTransaction line) {
        var info = line.getTransactionInfo();
        return info != null && CONVERSION_EVENT_CODE.equals(trimmed(info.getTransactionEventCode()));
    }

    private static String currencyOf(PayPalTransaction line) {
        var info = line.getTransactionInfo();
        var amount = info == null ? null : info.getTransactionAmount();
        return amount == null ? null : trimmed(amount.getCurrencyCode());
    }

    private static BigDecimal amountOf(PayPalTransaction line) {
        var info = line.getTransactionInfo();
        var amount = info == null ? null : info.getTransactionAmount();
        if (amount == null || amount.getValue() == null) {
            return null;
        }
        return amount.getValue().setScale(SCALE, RoundingMode.HALF_UP);
    }

    private static BigDecimal add(BigDecimal one, BigDecimal other) {
        if (one == null) {
            return other;
        }
        return other == null ? one : one.add(other);
    }

    private static String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
