package com.vastbricks.api.bankstatement;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Every request and response body of the bank statement feature. */
public final class BankStatementPayload {

    private BankStatementPayload() {
    }

    /** What an upload did, per account and in total, so a re-import can be seen to have updated rather than added. */
    @Getter
    @AllArgsConstructor
    public static final class ImportResponse {

        private final List<AccountImportResponse> accounts;
        private final int entriesRead;
        private final int created;
        private final int updated;
    }

    @Getter
    @AllArgsConstructor
    public static final class AccountImportResponse {

        private final String accountIban;
        private final int entriesRead;
        private final int created;
        private final int updated;
    }

    @Getter
    @AllArgsConstructor
    public static final class EntriesResponse {

        private final List<EntryResponse> entries;

        /** What the listed entries came to, one row per currency, in the order the screen states them. */
        private final List<CurrencySummaryResponse> summary;
    }

    /**
     * A currency's account of the period: what went out, what came in, and where the account stood at the end of it.
     *
     * <p>One row per currency rather than one total, because an account moving in two currencies has two accounts of
     * itself and adding them would state a sum no bank ever stated.
     */
    @Getter
    @AllArgsConstructor
    public static final class CurrencySummaryResponse {

        private final String currency;

        /** Unsigned, the way an entry's amount is: the direction is in the name rather than in the sign. */
        private final BigDecimal debitTurnover;

        private final BigDecimal creditTurnover;

        /**
         * Everything the account has moved up to the end of the period, credits less debits, and therefore signed.
         *
         * <p>Derived from the entries that are stored, so it is the closing balance only for an account imported
         * from its opening balance onward; a partial history states the movement it holds rather than the bank's own
         * figure, which no import reads.
         */
        private final BigDecimal closingBalance;
    }

    @Getter
    @Builder
    public static final class EntryResponse {

        private final Long id;
        private final String accountIban;
        private final String entryReference;
        private final LocalDate bookingDate;
        private final LocalDate valueDate;
        private final BigDecimal amount;
        private final String currency;
        private final BankStatementDirection direction;
        private final String status;
        private final String domainCode;
        private final String familyCode;
        private final String subFamilyCode;
        private final String proprietaryCode;
        private final String counterpartyName;
        private final String counterpartyIban;
        private final String counterpartyBic;
        private final String endToEndId;
        private final String instructionId;
        private final String remittanceInformation;

        /** The only field of an entry a person writes, and the only one an import leaves alone. */
        private final String mapping;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static final class MappingRequest {

        private String mapping;
    }
}
