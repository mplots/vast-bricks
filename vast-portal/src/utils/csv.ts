export type CsvValue = string | number | boolean | null | undefined;

/** Quote every cell so commas, quotes and multiline text round-trip unchanged. */
export function serializeCsv(rows: CsvValue[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let text = value == null ? '' : String(value);
          // Provider text must remain text when a spreadsheet opens the download.
          if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\r\n');
}

export function downloadCsv(filename: string, rows: CsvValue[][]): void {
  // A BOM lets spreadsheet applications recognize names and translated headers as UTF-8.
  const url = URL.createObjectURL(new Blob(['\uFEFF', serializeCsv(rows), '\r\n'], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the browser begin reading the download before releasing its URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
