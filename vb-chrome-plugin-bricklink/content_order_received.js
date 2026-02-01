function buildTrackingUrl(trackingNumber) {
    if (trackingNumber.toUpperCase().startsWith('CE')) {
        return `https://mana.omniva.lv/track/${encodeURIComponent(trackingNumber)}?language=lv`;
    }

    const url = new URL('https://mans.pasts.lv/track');
    url.searchParams.set('locale', 'lv-LV');
    url.searchParams.set('id', trackingNumber);
    return url.toString();
}

function parseBricklinkDate(value) {
    const text = value.trim();
    if (!text) return null;

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const match = text.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/);
    if (!match) return null;

    const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const month = months[match[1]];
    if (month === undefined) return null;

    return new Date(Number(match[3]), month, Number(match[2]));
}

function getHeaderIndex(headerRow, label) {
    if (!headerRow) return -1;
    const cells = Array.from(headerRow.children);
    return cells.findIndex(cell => cell.textContent.replace(/\s+/g, ' ').trim() === label);
}

function findOrdersTable() {
    return document.querySelector('table.orders-table');
}

function ensureTrackingHeaderColumn(table) {
    const headerRow = table.querySelector('tr.catalog-list__body-header');
    if (!headerRow || headerRow.querySelector('[data-vb-tracking-header]')) return;

    const trackingHeaderCell = Array.from(headerRow.children)
        .find(td => td.textContent.includes('Tracking Number'));
    if (!trackingHeaderCell) return;

    const newHeaderCell = document.createElement('td');
    newHeaderCell.setAttribute('data-vb-tracking-header', 'true');
    newHeaderCell.innerHTML = '<b>Tracking Link</b>';
    trackingHeaderCell.insertAdjacentElement('afterend', newHeaderCell);
}

function ensureDaysHeaderColumn(table) {
    const headerRow = table.querySelector('tr.catalog-list__body-header');
    if (!headerRow || headerRow.querySelector('[data-vb-days-header]')) return;

    const dateIndex = getHeaderIndex(headerRow, 'Date');
    if (dateIndex === -1) return;

    const dateHeaderCell = headerRow.children[dateIndex];
    if (!dateHeaderCell) return;

    const daysHeaderCell = document.createElement('td');
    daysHeaderCell.setAttribute('data-vb-days-header', 'true');
    daysHeaderCell.innerHTML = '<b>Days Ago</b>';
    dateHeaderCell.insertAdjacentElement('afterend', daysHeaderCell);
}

function ensureTotalsRowColumns(table) {
    const totalsRow = Array.from(table.querySelectorAll('tr.catalog-list__body-header'))
        .find(row => row.textContent.includes('Totals (in EUR):'));
    if (!totalsRow) return;

    if (totalsRow.getAttribute('data-vb-days-totals') !== 'true') {
        const firstColspanCell = totalsRow.querySelector('td[colspan]');
        if (firstColspanCell) {
            const current = Number(firstColspanCell.getAttribute('colspan'));
            if (!Number.isNaN(current)) {
                firstColspanCell.setAttribute('colspan', String(current + 1));
            }
        }
        totalsRow.setAttribute('data-vb-days-totals', 'true');
    }

    if (totalsRow.getAttribute('data-vb-tracking-totals') !== 'true') {
        const colspans = Array.from(totalsRow.querySelectorAll('td[colspan]'));
        const lastColspanCell = colspans[colspans.length - 1];
        if (lastColspanCell) {
            const current = Number(lastColspanCell.getAttribute('colspan'));
            if (!Number.isNaN(current)) {
                lastColspanCell.setAttribute('colspan', String(current + 1));
            }
        }
        totalsRow.setAttribute('data-vb-tracking-totals', 'true');
    }
}

function renderDaysCell(row, dateIndex) {
    if (dateIndex === -1) return;
    const cells = row.children;
    const dateCell = cells[dateIndex];
    if (!dateCell) return;

    let daysCell = row.querySelector('td[data-vb-days-cell]');
    if (!daysCell) {
        daysCell = document.createElement('td');
        daysCell.setAttribute('data-vb-days-cell', 'true');
        dateCell.insertAdjacentElement('afterend', daysCell);
    }

    const parsedDate = parseBricklinkDate(dateCell.textContent);
    if (!parsedDate) {
        daysCell.textContent = '';
        return;
    }

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
    const diffDays = Math.round((startOfToday - startOfDate) / 86400000);
    daysCell.textContent = Number.isNaN(diffDays) ? '' : String(diffDays);
}

function renderTrackingCell(row, input) {
    let linkCell = row.querySelector('td[data-vb-tracking-link]');
    if (!linkCell) {
        linkCell = document.createElement('td');
        linkCell.setAttribute('data-vb-tracking-link', 'true');
        const inputCell = input.closest('td');
        if (!inputCell) return;
        inputCell.insertAdjacentElement('afterend', linkCell);
    }

    const trackingNumber = input.value.trim();
    linkCell.textContent = '';
    if (!trackingNumber) return;

    const link = document.createElement('a');
    link.href = buildTrackingUrl(trackingNumber);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Track';
    link.title = trackingNumber;
    linkCell.appendChild(link);
}

function ensureDaysCell(row, table) {
    const headerRow = table.querySelector('tr.catalog-list__body-header');
    const dateIndex = getHeaderIndex(headerRow, 'Date');
    renderDaysCell(row, dateIndex);
}

function ensureTrackingCell(row) {
    const input = row.querySelector('input[name^="nT"]');
    if (!input) return;

    renderTrackingCell(row, input);

    if (input.getAttribute('data-vb-tracking-listener') === 'true') return;
    input.setAttribute('data-vb-tracking-listener', 'true');
    const update = () => renderTrackingCell(row, input);
    input.addEventListener('input', update);
    input.addEventListener('change', update);
}

function attachRow(row, table) {
    ensureDaysCell(row, table);
    ensureTrackingCell(row);
}

function attachExistingRows(table) {
    table.querySelectorAll('tr.orASCOrderRow').forEach(row => attachRow(row, table));
}

function observeRows(table) {
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (!(node instanceof HTMLElement)) return;
                if (node.matches('tr.orASCOrderRow')) {
                    attachRow(node, table);
                } else {
                    node.querySelectorAll?.('tr.orASCOrderRow').forEach(row => attachRow(row, table));
                }
            });
        }
    });

    const tbody = table.querySelector('tbody');
    if (tbody) {
        observer.observe(tbody, { childList: true, subtree: true });
    }
}

function init() {
    if (!window.location.pathname.includes('/orderReceived.asp')) return;

    const table = findOrdersTable();
    if (!table) return;

    ensureTrackingHeaderColumn(table);
    ensureDaysHeaderColumn(table);
    ensureTotalsRowColumns(table);
    attachExistingRows(table);
    observeRows(table);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
