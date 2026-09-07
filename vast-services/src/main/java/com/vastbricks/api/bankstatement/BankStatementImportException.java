package com.vastbricks.api.bankstatement;

/** An uploaded document that could not be read as camt.052 or camt.053, or that stated an entry incompletely. */
class BankStatementImportException extends RuntimeException {

    BankStatementImportException(String message) {
        super(message);
    }

    BankStatementImportException(String message, Throwable cause) {
        super(message, cause);
    }
}
