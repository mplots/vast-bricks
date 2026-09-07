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
