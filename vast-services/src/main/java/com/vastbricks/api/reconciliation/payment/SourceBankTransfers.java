package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.ledger.bank.BankTransfer;
import com.vastbricks.api.ledger.bank.BankTransfers;
import com.vastbricks.api.reconciliation.Source;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Reads the bank entries a month may have been paid by.
 *
 * <p>Unlike every other source this asks no provider: no bank exposes the account, so a statement is uploaded and
 * the entries are Vast's own stored data. It is a source all the same — it takes the month, states the entries it
 * found, and decides nothing about what any of them settled — and it runs in the sourcing fan-out beside the
 * providers, which is also what gives it the serving tenant on its thread.
 *
 * <p>It declares {@link BankTransfer} rather than a carrier of its own, as the provider payment sources declare
 * their own SDK models: it assembles nothing, and a carrier adding no field would only be needed if a second source
 * returned the same class.
 */
@Component
@RequiredArgsConstructor
class SourceBankTransfers implements Source<BankTransfer> {

    private final BankTransfers bankTransfers;

    @Override
    public Class<BankTransfer> type() {
        return BankTransfer.class;
    }

    @Override
    public List<BankTransfer> fetch(YearMonth month) {
        var window = BankTransferWindow.of(month);
        return bankTransfers.bookedBetween(window.from(), window.to());
    }
}
