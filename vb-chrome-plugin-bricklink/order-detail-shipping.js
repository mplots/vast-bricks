const VB_API_ENVIRONMENT_STORAGE_KEY = 'vbApiEnvironment';
const VB_LEGACY_API_BASE_URL_STORAGE_KEY = 'vbBrickSyncApiBaseUrl';
const VB_PROD_API_BASE_URL = 'https://tool.vastbricks.com';
const VB_LOCAL_API_BASE_URL = 'http://127.0.0.1:6161';

function getApiBaseUrl() {
    return new Promise(resolve => {
        chrome.storage.local.get([
            VB_API_ENVIRONMENT_STORAGE_KEY,
            VB_LEGACY_API_BASE_URL_STORAGE_KEY
        ], stored => {
            const environment = stored[VB_API_ENVIRONMENT_STORAGE_KEY]
                || (stored[VB_LEGACY_API_BASE_URL_STORAGE_KEY] === VB_LOCAL_API_BASE_URL ? 'local' : 'prod');
            resolve(environment === 'local' ? VB_LOCAL_API_BASE_URL : VB_PROD_API_BASE_URL);
        });
    });
}

function getOrderIdFromUrl() {
    const orderId = new URL(window.location.href).searchParams.get('ID');
    return /^\d+$/.test(orderId || '') ? orderId : null;
}

function findBuyerInformationElement() {
    const candidates = Array.from(document.querySelectorAll('b, strong, td, th, font, div, span'))
        .filter(element => element.textContent.trim().replace(/\s+/g, ' ') === 'Buyer Information');

    return candidates[0] || null;
}

function findBuyerInformationTable() {
    const label = findBuyerInformationElement();
    if (!label) return null;

    const sellerLabel = Array.from(document.querySelectorAll('b, strong, td, th, font, div, span'))
        .find(element => element.textContent.trim().replace(/\s+/g, ' ') === 'Seller Information');

    return Array.from(document.querySelectorAll('table'))
        .find(table => {
            const afterBuyerHeading = label.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING;
            const beforeSellerHeading = !sellerLabel || table.compareDocumentPosition(sellerLabel) & Node.DOCUMENT_POSITION_FOLLOWING;
            const hasBuyerRows = table.textContent.includes('Username:') && table.textContent.includes('Name & Address:');
            return afterBuyerHeading && beforeSellerHeading && hasBuyerRows;
        }) || null;
}

function normalizeText(value) {
    return value.trim().replace(/\s+/g, ' ');
}

function getShippingMethod() {
    const labelCell = Array.from(document.querySelectorAll('td, th'))
        .find(element => normalizeText(element.textContent).replace(/:$/, '') === 'Shipping Method');

    return normalizeText(labelCell?.nextElementSibling?.textContent || '');
}

function isLatvianPostShippingMethod() {
    return getShippingMethod().startsWith('Latvian Post');
}

function createStatus() {
    const status = document.createElement('span');
    status.style.marginLeft = '4px';
    status.style.font = '12px Arial, sans-serif';
    status.style.color = '#4b5563';
    return status;
}

function setStatus(status, message, color = '#4b5563') {
    status.textContent = message;
    status.style.color = color;
}

function downloadPdf(blob, orderId) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bricklink-order-${orderId}-shipping.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getHeaderFilename(contentDisposition) {
    if (!contentDisposition) return null;

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) {
        try {
            return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''));
        } catch (error) {
            return utf8Match[1].trim().replace(/^"|"$/g, '');
        }
    }

    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    return match ? match[1].trim() : null;
}

function findVatInvoiceUrl(orderId) {
    const links = Array.from(document.querySelectorAll('a[href*="/_file/orders/vat_invoice.file"]'));
    const link = links.find(anchor => {
        const url = new URL(anchor.getAttribute('href'), window.location.origin);
        return url.searchParams.get('oid') === String(orderId) && url.searchParams.get('type') === 'I';
    });
    if (link) {
        return new URL(link.getAttribute('href'), window.location.origin).toString();
    }

    const source = document.documentElement.innerHTML;
    const pattern = new RegExp(`/_file/orders/vat_invoice\\.file\\?[^"'<>\\s]*oid=${orderId}[^"'<>\\s]*type=I[^"'<>\\s]*`);
    const match = source.match(pattern);
    return match ? new URL(match[0].replaceAll('&amp;', '&'), window.location.origin).toString() : null;
}

async function downloadVatInvoice(orderId) {
    const url = findVatInvoiceUrl(orderId);
    if (!url) return null;

    const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/pdf' }
    });

    if (!response.ok) {
        return null;
    }

    const blob = await response.blob();

    return {
        blob,
        filename: getHeaderFilename(response.headers.get('Content-Disposition')) || `vat-invoice-${orderId}.pdf`
    };
}

async function requestShippingLabel(orderId, weight, status, button) {
    button.disabled = true;
    setStatus(status, 'Downloading VAT invoice...');

    try {
        const vatInvoice = await downloadVatInvoice(orderId);
        setStatus(status, 'Creating label...');

        const apiBaseUrl = await getApiBaseUrl();
        const formData = new FormData();
        formData.append('orderId', String(Number(orderId)));
        formData.append('weight', String(Number(weight)));
        if (vatInvoice) {
            formData.append('vatInvoiceFilename', vatInvoice.filename);
            formData.append('vatInvoiceFile', vatInvoice.blob, vatInvoice.filename);
        }

        const response = await fetch(`${apiBaseUrl}/api/bricklink/shipping-request`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || `${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        downloadPdf(blob, orderId);

        const barcode = response.headers.get('X-Mans-Pasts-Barcode');
        const details = [barcode && `barcode ${barcode}`].filter(Boolean);
        setStatus(status, details.length ? `Done: ${details.join(', ')}` : 'Done', '#047857');
    } catch (error) {
        setStatus(status, error.message || 'Request failed', '#b91c1c');
    } finally {
        button.disabled = false;
    }
}

function createShippingControls(orderId, compact = false) {
    const wrapper = document.createElement('div');
    wrapper.id = 'vb-order-detail-shipping-request';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.flexWrap = 'wrap';
    wrapper.style.gap = '8px';
    wrapper.style.padding = '6px 8px';
    wrapper.style.background = '#eff6ff';
    wrapper.style.border = '1px solid #93c5fd';
    wrapper.style.borderRadius = '4px';
    wrapper.style.font = '12px Arial, sans-serif';

    const label = document.createElement('label');
    label.textContent = 'Weight kg';
    label.htmlFor = 'vb-order-detail-shipping-weight';
    label.style.fontWeight = '700';
    label.style.color = '#1e3a8a';

    const input = document.createElement('input');
    input.id = 'vb-order-detail-shipping-weight';
    input.type = 'number';
    input.min = '0.001';
    input.step = '0.001';
    input.style.width = '74px';
    input.style.boxSizing = 'border-box';
    input.style.padding = '4px 6px';
    input.style.border = '1px solid #7aa7d9';
    input.style.borderRadius = '3px';
    input.style.background = '#ffffff';
    input.style.font = '12px Arial, sans-serif';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Create shipping';
    button.style.padding = '4px 8px';
    button.style.border = '1px solid #2563eb';
    button.style.borderRadius = '3px';
    button.style.background = '#dbeafe';
    button.style.color = '#1d4ed8';
    button.style.cursor = 'pointer';
    button.style.font = '700 12px Arial, sans-serif';

    const status = createStatus();

    button.addEventListener('click', () => {
        const weight = input.value.trim();
        if (!weight || Number(weight) <= 0) {
            setStatus(status, 'Enter weight in kg', '#b91c1c');
            input.focus();
            return;
        }

        requestShippingLabel(orderId, weight, status, button);
    });

    wrapper.append(label, input, button, status);
    if (compact) {
        wrapper.style.margin = '4px 0';
    }
    return wrapper;
}

function insertControls(orderId) {
    if (document.getElementById('vb-order-detail-shipping-request')) return;

    const buyerTable = findBuyerInformationTable();

    if (buyerTable?.tBodies?.[0]) {
        const row = buyerTable.tBodies[0].insertRow(-1);
        row.setAttribute('bgcolor', '#EEEEEE');

        const labelCell = row.insertCell(0);
        labelCell.innerHTML = '&nbsp;Shipping Label:';
        labelCell.style.width = '25%';
        labelCell.style.fontWeight = '700';

        const cell = row.insertCell(1);
        cell.style.width = '75%';
        const controls = createShippingControls(orderId, true);
        cell.appendChild(controls);
        return;
    }

    const label = findBuyerInformationElement();
    if (label) {
        const controls = createShippingControls(orderId);
        label.insertAdjacentElement('afterend', controls);
    }
}

function initOrderDetailShipping() {
    const orderId = getOrderIdFromUrl();
    if (!orderId) return;
    if (!isLatvianPostShippingMethod()) return;

    insertControls(orderId);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrderDetailShipping);
} else {
    initOrderDetailShipping();
}
