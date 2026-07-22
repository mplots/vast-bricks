function buildLatvijasPastsTrackingUrl(trackingNumber) {
    const url = new URL('https://mans.pasts.lv/track');
    url.searchParams.set('locale', 'lv-LV');
    url.searchParams.set('id', trackingNumber);
    return url.toString();
}

function findOrdersTable() {
    return document.querySelector('table.orders-table');
}

function updateOrderDetailLink(link) {
    const url = new URL(link.getAttribute('href'), window.location.origin);
    if (url.pathname !== '/orderDetail.asp' || !url.searchParams.has('ID')) return;

    url.searchParams.set('viewChk', 'Y');
    url.searchParams.set('viewWeight', 'Y');
    url.searchParams.set('viewRemain', 'Y');
    link.href = url.pathname + url.search;
}

function updateOrderDetailLinks(root = document) {
    if (root instanceof HTMLAnchorElement && root.matches('a[href*="orderDetail.asp?ID="]')) {
        updateOrderDetailLink(root);
    }
    root.querySelectorAll?.('a[href*="orderDetail.asp?ID="]').forEach(updateOrderDetailLink);
}

function ensureTrackingHeaderColumn(table) {
    const headerRow = table.querySelector('tr.catalog-list__body-header');
    if (!headerRow || headerRow.querySelector('[data-vb-lp-tracking-header]')) return;

    const trackingHeaderCell = Array.from(headerRow.children)
        .find(td => td.textContent.includes('Tracking Number'));
    if (!trackingHeaderCell) return;

    const newHeaderCell = document.createElement('td');
    newHeaderCell.setAttribute('data-vb-lp-tracking-header', 'true');
    newHeaderCell.innerHTML = '<b>Latvijas Pasts</b>';
    trackingHeaderCell.insertAdjacentElement('afterend', newHeaderCell);
}

function findHeaderCell(table, label) {
    const headerRow = table.querySelector('tr.catalog-list__body-header');
    if (!headerRow) return null;

    return Array.from(headerRow.children)
        .find(td => td.textContent.trim().replace(/\s+/g, ' ').includes(label));
}

function ensureAgeHeaderColumns(table) {
    const headerRow = table.querySelector('tr.catalog-list__body-header');
    if (!headerRow || headerRow.querySelector('[data-vb-order-days-header]')) return;

    const dateHeaderCell = findHeaderCell(table, 'Date');
    if (!dateHeaderCell) return;

    const daysHeaderCell = document.createElement('td');
    daysHeaderCell.setAttribute('data-vb-order-days-header', 'true');
    daysHeaderCell.innerHTML = '<b>Days Ago</b>';

    const workdaysHeaderCell = document.createElement('td');
    workdaysHeaderCell.setAttribute('data-vb-order-workdays-header', 'true');
    workdaysHeaderCell.innerHTML = '<b>Workdays Ago</b>';

    dateHeaderCell.insertAdjacentElement('afterend', workdaysHeaderCell);
    dateHeaderCell.insertAdjacentElement('afterend', daysHeaderCell);
}

function ensureTotalsRowColumn(table) {
    const totalsRow = Array.from(table.querySelectorAll('tr.catalog-list__body-header'))
        .find(row => row.textContent.includes('Totals (in EUR):'));
    if (!totalsRow || totalsRow.getAttribute('data-vb-lp-tracking-totals') === 'true') return;

    const colspans = Array.from(totalsRow.querySelectorAll('td[colspan]'));
    const lastColspanCell = colspans[colspans.length - 1];
    if (lastColspanCell) {
        const current = Number(lastColspanCell.getAttribute('colspan'));
        if (!Number.isNaN(current)) {
            lastColspanCell.setAttribute('colspan', String(current + 3));
        }
    }
    totalsRow.setAttribute('data-vb-lp-tracking-totals', 'true');
}

function parseOrderDate(text) {
    const normalized = text.trim().replace(/\s+/g, ' ');
    if (!normalized) return null;

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const parts = normalized.match(/^([A-Za-z]{3,})\s+(\d{1,2}),\s+(\d{4})(?:,\s+(\d{1,2}):(\d{2}))?/);
    if (!parts) return null;

    const month = [
        'jan', 'feb', 'mar', 'apr', 'may', 'jun',
        'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
    ].indexOf(parts[1].slice(0, 3).toLowerCase());
    if (month < 0) return null;

    return new Date(
        Number(parts[3]),
        month,
        Number(parts[2]),
        Number(parts[4] || 0),
        Number(parts[5] || 0)
    );
}

function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgo(orderDate) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((startOfLocalDay(new Date()) - startOfLocalDay(orderDate)) / millisecondsPerDay));
}

function workdaysAgo(orderDate) {
    const cursor = startOfLocalDay(orderDate);
    const today = startOfLocalDay(new Date());
    let count = 0;

    while (cursor < today) {
        cursor.setDate(cursor.getDate() + 1);
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) {
            count += 1;
        }
    }

    return count;
}

function findDateCell(row) {
    return Array.from(row.children)
        .find(td => parseOrderDate(td.textContent));
}

function renderAgeCells(row) {
    if (row.querySelector('[data-vb-order-days]')) return;

    const dateCell = findDateCell(row);
    const orderDate = parseOrderDate(dateCell?.textContent || '');
    if (!dateCell || !orderDate) return;

    const daysCell = document.createElement('td');
    daysCell.setAttribute('data-vb-order-days', 'true');
    daysCell.textContent = String(daysAgo(orderDate));

    const workdaysCell = document.createElement('td');
    workdaysCell.setAttribute('data-vb-order-workdays', 'true');
    workdaysCell.textContent = String(workdaysAgo(orderDate));

    dateCell.insertAdjacentElement('afterend', workdaysCell);
    dateCell.insertAdjacentElement('afterend', daysCell);
}

function renderTrackingCell(row, input) {
    let linkCell = row.querySelector('td[data-vb-lp-tracking-link]');
    if (!linkCell) {
        linkCell = document.createElement('td');
        linkCell.setAttribute('data-vb-lp-tracking-link', 'true');
        const inputCell = input.closest('td');
        if (!inputCell) return;
        inputCell.insertAdjacentElement('afterend', linkCell);
    }

    const trackingNumber = input.value.trim();
    linkCell.textContent = '';
    if (!trackingNumber) return;

    const link = document.createElement('a');
    link.href = buildLatvijasPastsTrackingUrl(trackingNumber);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Pasts';
    link.title = trackingNumber;
    linkCell.appendChild(link);
}

function attachRow(row) {
    updateOrderDetailLinks(row);
    renderAgeCells(row);

    const input = row.querySelector('input[name^="nT"]');
    if (!input) return;

    renderTrackingCell(row, input);

    if (input.getAttribute('data-vb-lp-tracking-listener') === 'true') return;
    input.setAttribute('data-vb-lp-tracking-listener', 'true');
    const update = () => renderTrackingCell(row, input);
    input.addEventListener('input', update);
    input.addEventListener('change', update);
}

function attachExistingRows(table) {
    table.querySelectorAll('tr.orASCOrderRow').forEach(attachRow);
}

function observeRows(table) {
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (!(node instanceof HTMLElement)) return;
                updateOrderDetailLinks(node);
                if (node.matches('tr.orASCOrderRow')) {
                    attachRow(node);
                } else {
                    node.querySelectorAll?.('tr.orASCOrderRow').forEach(attachRow);
                }
            });
        }
    });

    const tbody = table.querySelector('tbody');
    if (tbody) {
        observer.observe(tbody, { childList: true, subtree: true });
    }
}

function initMansPastsLinks() {
    const table = findOrdersTable();
    if (!table) return;

    updateOrderDetailLinks();
    ensureTrackingHeaderColumn(table);
    ensureAgeHeaderColumns(table);
    ensureTotalsRowColumn(table);
    attachExistingRows(table);
    observeRows(table);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMansPastsLinks);
} else {
    initMansPastsLinks();
}
