package com.vastbricks.api.ledger.bank;

/** Which way an entry moved the account, as camt states it in {@code CdtDbtInd}. */
public enum BankStatementDirection {

    CREDIT,
    DEBIT;

    /** The direction {@code CdtDbtInd} names, or {@code null} for anything else. */
    static BankStatementDirection of(String indicator) {
        if (indicator == null) {
            return null;
        }
        return switch (indicator.trim().toUpperCase()) {
            case "CRDT" -> CREDIT;
            case "DBIT" -> DEBIT;
            default -> null;
        };
    }
}
