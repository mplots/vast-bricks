export type BankStatementDirection = 'CREDIT' | 'DEBIT';

/** One entry of a bank account, as an imported camt document stated it. */
export interface BankStatementEntry {
  id: number;
  accountIban: string;
  entryReference: string;
  bookingDate: string;
  valueDate: string | null;
  /** Unsigned, the way camt states it; `direction` says which way the account moved. */
  amount: number;
  currency: string;
  direction: BankStatementDirection;
  status: string;
  domainCode: string | null;
  familyCode: string | null;
  subFamilyCode: string | null;
  proprietaryCode: string | null;
  counterpartyName: string | null;
  counterpartyIban: string | null;
  counterpartyBic: string | null;
  endToEndId: string | null;
  instructionId: string | null;
  remittanceInformation: string | null;
  /** The only field of an entry a person writes, and the only one an import leaves alone. */
  mapping: string | null;
}

/**
 * What a period came to in one currency. One row per currency the period moved in, because an account moving in two
 * currencies has two accounts of itself and adding them would state a sum no bank ever stated.
 */
export interface BankStatementCurrencySummary {
  currency: string;
  /** Unsigned, the way an entry's amount is: the direction is in the name rather than in the sign. */
  debitTurnover: number;
  creditTurnover: number;
  /** Credits less debits over every stored entry up to the end of the period, and therefore signed. */
  closingBalance: number;
}

export interface BankStatementEntriesPage {
  entries: BankStatementEntry[];
  summary: BankStatementCurrencySummary[];
}

export interface BankStatementAccountImport {
  accountIban: string;
  entriesRead: number;
  created: number;
  updated: number;
}

/** What an import did, which is how a re-import is seen to have updated rather than added. */
export interface BankStatementImportResult {
  accounts: BankStatementAccountImport[];
  entriesRead: number;
  created: number;
  updated: number;
}
