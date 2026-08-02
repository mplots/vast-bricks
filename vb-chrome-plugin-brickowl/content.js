const VB_BRICKOWL_SHIPPING_LABEL_API_URL = 'https://tool.vastbricks.com/api/shipping-label/brickowl';

function getBrickOwlOrderIdFromUrl() {
    const match = window.location.pathname.match(/^\/mystore\/orders\/history\/(\d+)\/?$/);
    return match ? match[1] : null;
}

function normalizeText(value) {
    return (value || '').trim().replace(/\s+/g, ' ');
}

function findOrderDetailsBlock() {
    return Array.from(document.querySelectorAll('.order-block'))
        .find(block => normalizeText(block.querySelector('.order-block-title')?.textContent) === 'Order Details') || null;
}

function findOrderDetailsTable() {
    return findOrderDetailsBlock()?.querySelector('table.form-list') || null;
}

function findOrderDetailsRow(label) {
    const table = findOrderDetailsTable();
    if (!table) return null;

    return Array.from(table.querySelectorAll('tr'))
        .find(row => normalizeText(row.querySelector('.flabel')?.textContent).replace(/\s+Edit$/, '') === label) || null;
}

function getShippingMethod() {
    return normalizeText(findOrderDetailsRow('Shipping Method')?.querySelector('.value')?.textContent || '');
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
    link.download = `brickowl-order-${orderId}-shipping.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function requestShippingLabel(orderId, weightKg, status, button) {
    button.disabled = true;
    setStatus(status, 'Creating label...');

    try {
        const response = await fetch(VB_BRICKOWL_SHIPPING_LABEL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                weight: Number(weightKg)
            })
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

function createShippingControls(orderId) {
    const wrapper = document.createElement('div');
    wrapper.id = 'vb-brickowl-shipping-label';
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
    label.htmlFor = 'vb-brickowl-shipping-weight';
    label.style.fontWeight = '700';
    label.style.color = '#1e3a8a';

    const input = document.createElement('input');
    input.id = 'vb-brickowl-shipping-weight';
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
    return wrapper;
}

function insertControls(orderId) {
    if (document.getElementById('vb-brickowl-shipping-label')) return;

    const shippingMethodRow = findOrderDetailsRow('Shipping Method');
    if (!shippingMethodRow) return;

    const row = document.createElement('tr');
    row.className = shippingMethodRow.classList.contains('odd') ? 'even' : 'odd';

    const labelCell = document.createElement('td');
    labelCell.className = 'flabel';
    labelCell.textContent = 'Shipping Label';

    const valueCell = document.createElement('td');
    valueCell.className = 'value';
    valueCell.appendChild(createShippingControls(orderId));

    row.append(labelCell, valueCell);
    shippingMethodRow.insertAdjacentElement('afterend', row);
}

function initBrickOwlOrderShipping() {
    const orderId = getBrickOwlOrderIdFromUrl();
    if (!orderId) return;
    if (!isLatvianPostShippingMethod()) return;

    insertControls(orderId);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBrickOwlOrderShipping);
} else {
    initBrickOwlOrderShipping();
}
