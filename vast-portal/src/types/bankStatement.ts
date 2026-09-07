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

export interface BankStatementEntriesPage {
  entries: BankStatementEntry[];
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
