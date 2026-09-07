/**
 * camt documents for the bank statement import scenarios.
 *
 * <p>Written out here rather than kept as fixture files so a scenario can state the entries it is about and read
 * back the same values it asked for. The two builders differ only in the wrapper element, which is the only thing
 * that separates camt.052 from camt.053 as far as an import is concerned.
 */

export type CamtEntry = {
  /** The bank's own reference. Left out to exercise the import's own keying of an unreferenced entry. */
  readonly reference?: string;
  readonly amount: string;
  readonly currency?: string;
  readonly direction: 'CRDT' | 'DBIT';
  readonly bookingDate: string;
  readonly counterpartyName?: string;
  readonly counterpartyIban?: string;
  readonly remittance?: string;
  readonly proprietaryCode?: string;
};

export type CamtDocumentOptions = {
  readonly accountIban?: string;
  readonly entries: readonly CamtEntry[];
};

export const testAccountIban = 'LV29HABA0551064345221';

function entryXml(entry: CamtEntry): string {
  const currency = entry.currency ?? 'EUR';
  const party = entry.direction === 'DBIT' ? 'Cdtr' : 'Dbtr';
  const parties =
    entry.counterpartyName || entry.counterpartyIban
      ? `<RltdPties>` +
        (entry.counterpartyName ? `<${party}><Nm>${entry.counterpartyName}</Nm></${party}>` : '') +
        (entry.counterpartyIban ? `<${party}Acct><Id><IBAN>${entry.counterpartyIban}</IBAN></Id></${party}Acct>` : '') +
        `</RltdPties>`
      : '';

  return (
    `<Ntry>` +
    `<Amt Ccy="${currency}">${entry.amount}</Amt>` +
    `<CdtDbtInd>${entry.direction}</CdtDbtInd>` +
    `<Sts>BOOK</Sts>` +
    `<BookgDt><Dt>${entry.bookingDate}</Dt></BookgDt>` +
    `<ValDt><Dt>${entry.bookingDate}</Dt></ValDt>` +
    (entry.reference ? `<AcctSvcrRef>${entry.reference}</AcctSvcrRef>` : '') +
    `<BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn>` +
    (entry.proprietaryCode ? `<Prtry><Cd>${entry.proprietaryCode}</Cd><Issr>Test Bank</Issr></Prtry>` : '') +
    `</BkTxCd>` +
    `<NtryDtls><TxDtls>` +
    parties +
    (entry.remittance ? `<RmtInf><Ustrd>${entry.remittance}</Ustrd></RmtInf>` : '') +
    `</TxDtls></NtryDtls>` +
    `</Ntry>`
  );
}

function documentXml(namespace: string, wrapper: string, report: string, options: CamtDocumentOptions): string {
  const accountIban = options.accountIban ?? testAccountIban;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:${namespace}">` +
    `<${wrapper}><GrpHdr><MsgId>acceptance-${Date.now()}</MsgId></GrpHdr>` +
    `<${report}><Id>acceptance-report</Id>` +
    `<Acct><Id><IBAN>${accountIban}</IBAN></Id><Ccy>EUR</Ccy></Acct>` +
    options.entries.map(entryXml).join('') +
    `</${report}></${wrapper}></Document>`
  );
}

/** An account report, which is what Swedbank exports for a range that has not closed yet. */
export function camt052(options: CamtDocumentOptions): string {
  return documentXml('camt.052.001.02', 'BkToCstmrAcctRpt', 'Rpt', options);
}

/** A closed statement, which differs only in its wrapper. */
export function camt053(options: CamtDocumentOptions): string {
  return documentXml('camt.053.001.02', 'BkToCstmrStmt', 'Stmt', options);
}

/** Posts a document the way the portal does: the file's own text as the request body. */
export function importDocument(request: { post: Function }, document: string) {
  return request.post('/api/private/bank-statements', {
    headers: { 'Content-Type': 'application/xml' },
    data: document,
  });
}
