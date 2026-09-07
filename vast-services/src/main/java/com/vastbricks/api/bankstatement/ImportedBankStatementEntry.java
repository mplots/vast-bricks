package com.vastbricks.api.bankstatement;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

/**
 * One entry as an imported document stated it, flattened out of camt's nesting.
 *
 * <p>What the reader hands the service. It is deliberately not the entity: an import decides every field here and
 * none of them is {@code mapping}, so there is no field on this class for an import to overwrite it from.
 */
@Getter
@Builder(toBuilder = true)
class ImportedBankStatementEntry {

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
}
