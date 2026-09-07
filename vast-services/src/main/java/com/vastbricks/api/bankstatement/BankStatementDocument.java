package com.vastbricks.api.bankstatement;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlText;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The shape of an ISO 20022 camt.052 or camt.053 document, as much of it as an import reads.
 *
 * <p>The two differ only in their wrapper — camt.052 reports under {@code BkToCstmrAcctRpt/Rpt} and camt.053 states
 * under {@code BkToCstmrStmt/Stmt} — and are the same shape from the account down, so one model covers both and
 * {@link #reports()} is the only place the difference is spoken of.
 *
 * <p>The whole tree lives in this one file because none of it is used outside the reader: these are the document's
 * own nesting, not types the feature passes around. Everything is mapped by element local name, so camt's default
 * namespace needs no handling, and every class ignores what it does not read — balances, the transaction summary and
 * the account owner are all deliberately unread.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JacksonXmlRootElement(localName = "Document")
class BankStatementDocument {

    @JacksonXmlProperty(localName = "BkToCstmrAcctRpt")
    private ReportGroup accountReport;

    @JacksonXmlProperty(localName = "BkToCstmrStmt")
    private ReportGroup statement;

    /** The reports this document carries, whichever of the two wrappers it used, or empty when it used neither. */
    List<Report> reports() {
        if (accountReport != null && accountReport.getReports() != null) {
            return accountReport.getReports();
        }
        if (statement != null && statement.getStatements() != null) {
            return statement.getStatements();
        }
        return List.of();
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class ReportGroup {

        @JacksonXmlProperty(localName = "Rpt")
        @JacksonXmlElementWrapper(useWrapping = false)
        private List<Report> reports;

        @JacksonXmlProperty(localName = "Stmt")
        @JacksonXmlElementWrapper(useWrapping = false)
        private List<Report> statements;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Report {

        @JacksonXmlProperty(localName = "Id")
        private String id;

        @JacksonXmlProperty(localName = "Acct")
        private Account account;

        @JacksonXmlProperty(localName = "Ntry")
        @JacksonXmlElementWrapper(useWrapping = false)
        private List<Entry> entries;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Account {

        @JacksonXmlProperty(localName = "Id")
        private AccountIdentification id;

        @JacksonXmlProperty(localName = "Ccy")
        private String currency;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class AccountIdentification {

        @JacksonXmlProperty(localName = "IBAN")
        private String iban;

        @JacksonXmlProperty(localName = "Othr")
        private OtherIdentification other;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OtherIdentification {

        @JacksonXmlProperty(localName = "Id")
        private String id;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Entry {

        @JacksonXmlProperty(localName = "NtryRef")
        private String entryReference;

        @JacksonXmlProperty(localName = "AcctSvcrRef")
        private String accountServicerReference;

        @JacksonXmlProperty(localName = "Amt")
        private Amount amount;

        @JacksonXmlProperty(localName = "CdtDbtInd")
        private String creditDebitIndicator;

        @JacksonXmlProperty(localName = "Sts")
        private Status status;

        @JacksonXmlProperty(localName = "BookgDt")
        private DateChoice bookingDate;

        @JacksonXmlProperty(localName = "ValDt")
        private DateChoice valueDate;

        @JacksonXmlProperty(localName = "BkTxCd")
        private BankTransactionCode bankTransactionCode;

        @JacksonXmlProperty(localName = "NtryDtls")
        private EntryDetails details;

        @JacksonXmlProperty(localName = "AddtlNtryInf")
        private String additionalInformation;
    }

    /**
     * An amount and the currency it is stated in, which camt writes as an attribute of the amount itself.
     *
     * <p>The {@code @JsonCreator} is what lets it also be read from an element with no attributes at all. Jackson
     * cannot build a bean out of a bare text node without one, whatever {@code @JacksonXmlText} says.
     */
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Amount {

        @JacksonXmlProperty(localName = "Ccy", isAttribute = true)
        private String currency;

        @JacksonXmlText
        private String value;

        @JsonCreator
        Amount(String value) {
            this.value = value;
        }
    }

    /**
     * Whether the entry is booked or still pending. Stated as a bare code in {@code camt.052.001.02} and as
     * {@code Sts/Cd} from the later versions on, so both are read and whichever is present answers.
     */
    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Status {

        @JacksonXmlText
        private String text;

        @JacksonXmlProperty(localName = "Cd")
        private String code;

        @JsonCreator
        Status(String text) {
            this.text = text;
        }

        String value() {
            if (code != null && !code.isBlank()) {
                return code.trim();
            }
            return text == null || text.isBlank() ? null : text.trim();
        }
    }

    /** A camt date, which is a day or a moment depending on what the bank knew. */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class DateChoice {

        @JacksonXmlProperty(localName = "Dt")
        private String date;

        @JacksonXmlProperty(localName = "DtTm")
        private String dateTime;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class BankTransactionCode {

        @JacksonXmlProperty(localName = "Domn")
        private Domain domain;

        @JacksonXmlProperty(localName = "Prtry")
        private Proprietary proprietary;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Domain {

        @JacksonXmlProperty(localName = "Cd")
        private String code;

        @JacksonXmlProperty(localName = "Fmly")
        private Family family;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Family {

        @JacksonXmlProperty(localName = "Cd")
        private String code;

        @JacksonXmlProperty(localName = "SubFmlyCd")
        private String subFamilyCode;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Proprietary {

        @JacksonXmlProperty(localName = "Cd")
        private String code;

        @JacksonXmlProperty(localName = "Issr")
        private String issuer;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class EntryDetails {

        @JacksonXmlProperty(localName = "TxDtls")
        @JacksonXmlElementWrapper(useWrapping = false)
        private List<TransactionDetails> transactions;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class TransactionDetails {

        @JacksonXmlProperty(localName = "Refs")
        private References references;

        @JacksonXmlProperty(localName = "RltdPties")
        private RelatedParties relatedParties;

        @JacksonXmlProperty(localName = "RltdAgts")
        private RelatedAgents relatedAgents;

        @JacksonXmlProperty(localName = "RmtInf")
        private RemittanceInformation remittanceInformation;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class References {

        @JacksonXmlProperty(localName = "AcctSvcrRef")
        private String accountServicerReference;

        @JacksonXmlProperty(localName = "EndToEndId")
        private String endToEndId;

        @JacksonXmlProperty(localName = "InstrId")
        private String instructionId;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class RelatedParties {

        @JacksonXmlProperty(localName = "Cdtr")
        private Party creditor;

        @JacksonXmlProperty(localName = "CdtrAcct")
        private Account creditorAccount;

        @JacksonXmlProperty(localName = "Dbtr")
        private Party debtor;

        @JacksonXmlProperty(localName = "DbtrAcct")
        private Account debtorAccount;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Party {

        @JacksonXmlProperty(localName = "Nm")
        private String name;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class RelatedAgents {

        @JacksonXmlProperty(localName = "CdtrAgt")
        private Agent creditorAgent;

        @JacksonXmlProperty(localName = "DbtrAgt")
        private Agent debtorAgent;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class Agent {

        @JacksonXmlProperty(localName = "FinInstnId")
        private FinancialInstitution financialInstitution;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class FinancialInstitution {

        @JacksonXmlProperty(localName = "BIC")
        private String bic;

        @JacksonXmlProperty(localName = "BICFI")
        private String bicfi;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class RemittanceInformation {

        @JacksonXmlProperty(localName = "Ustrd")
        @JacksonXmlElementWrapper(useWrapping = false)
        private List<String> unstructured;
    }
}
