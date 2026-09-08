package com.vastbricks.api.ledger.bank;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

/**
 * One booked bank entry as another feature reads it.
 *
 * <p>The bank is the one party to an order Vast cannot read live, so a feature reconciling against it reads what an
 * import left rather than a provider. This is that read model: the stated facts of an entry and nothing about how it
 * came to be stored, so importing, upserting and the mapping a person writes stay this feature's own business.
 *
 * <p>Amounts arrive normalized to two decimals, {@link BankStatementReader} having normalized them once at import,
 * so a caller compares them exactly rather than rounding them again.
 */
@Getter
@Builder
public final class BankTransfer {

    /** The bank's own reference, which is what identifies this entry across imports. */
    private final String entryReference;

    private final String accountIban;

    private final LocalDate bookingDate;

    /** Unsigned, the way camt states it; {@link #direction} says which way it went. */
    private final BigDecimal amount;

    private final String currency;

    private final BankStatementDirection direction;

    /** Whoever the account is not: the payer of a credit, the payee of a debit. */
    private final String counterpartyName;

    /** What the payer wrote on the transfer, which is where an order is normally named. */
    private final String remittanceInformation;

    /**
     * What a person wrote against this entry when no automatic match found its order. It is exposed because it is the
     * manual last resort a reconciling feature is meant to honour before anything it can work out for itself.
     */
    private final String mapping;
}
