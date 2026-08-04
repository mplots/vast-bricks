const VB_CUSTOMER_SHIPPING_WEIGHT_LIMITS_GRAMS = [80, 400, 800, 1600, 2500];
const VB_ACTUAL_SHIPPING_WEIGHT_LIMITS_GRAMS = [100, 500, 1000, 2000, 3000];

function vbNormalizeOrderDetailWeightText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function vbParseGramWeight(value) {
    const matches = Array.from(String(value || '').matchAll(/([\d.,]+)\s*g\b/gi));
    if (!matches.length) return null;

    const grams = Number(matches[matches.length - 1][1].replace(',', '.'));
    return Number.isFinite(grams) ? grams : null;
}

function vbFindEstimatedOrderWeightGrams() {
    const estimatedWeightLabel = Array.from(document.querySelectorAll('td, th, font, b, strong, span, div'))
        .find(element => vbNormalizeOrderDetailWeightText(element.textContent).replace(/:$/, '') === 'Estimated Weight of Order');

    if (estimatedWeightLabel) {
        const rowWeight = vbParseGramWeight(estimatedWeightLabel.closest('tr')?.textContent);
        if (rowWeight !== null) return rowWeight;
    }

    const batchTotalRow = Array.from(document.querySelectorAll('tr'))
        .find(row => vbNormalizeOrderDetailWeightText(row.textContent).includes('Batch Total:'));

    return vbParseGramWeight(batchTotalRow?.textContent);
}

function vbCalculatePackageWeightTarget(orderWeightGrams) {
    const tierIndex = VB_CUSTOMER_SHIPPING_WEIGHT_LIMITS_GRAMS
        .findIndex(limit => orderWeightGrams <= limit);

    if (tierIndex === -1) return null;

    const targetWeightGrams = VB_ACTUAL_SHIPPING_WEIGHT_LIMITS_GRAMS[tierIndex];
    return {
        orderWeightGrams,
        targetWeightGrams,
        packagingAllowanceGrams: Math.max(0, targetWeightGrams - orderWeightGrams)
    };
}

function vbFormatGramWeight(value) {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(2).replace(/\.?0+$/, '');
}

function vbFormatKilogramWeight(value) {
    return (value / 1000).toFixed(3).replace(/\.?0+$/, '');
}

function vbSetPackageWeightTargetState(element, target, enteredWeightKg) {
    const enteredWeightGrams = Number(enteredWeightKg) * 1000;
    const exceedsTarget = Number.isFinite(enteredWeightGrams) && enteredWeightGrams > target.targetWeightGrams;

    element.style.border = exceedsTarget ? '1px solid #fca5a5' : '1px solid #86efac';
    element.style.background = exceedsTarget ? '#fef2f2' : '#f0fdf4';
    element.style.color = exceedsTarget ? '#b91c1c' : '#166534';
}

function vbWatchPackageWeightInput(element, target) {
    const input = document.getElementById('vb-order-detail-shipping-weight');
    if (!input) return;

    const updateState = () => vbSetPackageWeightTargetState(element, target, input.value);
    input.addEventListener('input', updateState);
    input.addEventListener('change', updateState);
    updateState();
}

function vbCreatePackageWeightTarget(target) {
    const element = document.createElement('span');
    element.id = 'vb-order-detail-package-weight-target';
    element.style.display = 'inline-flex';
    element.style.alignItems = 'center';
    element.style.gap = '4px';
    element.style.flex = '0 0 auto';
    element.style.boxSizing = 'border-box';
    element.style.padding = '3px 6px';
    element.style.borderRadius = '3px';
    element.style.font = '700 12px Arial, sans-serif';
    element.title = `Package max: ${vbFormatGramWeight(target.targetWeightGrams)}g. Packaging allowance: ${vbFormatGramWeight(target.packagingAllowanceGrams)}g.`;
    element.textContent = `Package max ${vbFormatKilogramWeight(target.targetWeightGrams)} kg`;
    vbSetPackageWeightTargetState(element, target, null);
    vbWatchPackageWeightInput(element, target);

    return element;
}

function vbInsertPackageWeightTarget() {
    if (document.getElementById('vb-order-detail-package-weight-target')) return true;

    const shippingControls = document.getElementById('vb-order-detail-shipping-request');
    if (!shippingControls) return false;

    const orderWeightGrams = vbFindEstimatedOrderWeightGrams();
    if (orderWeightGrams === null) return true;

    const target = vbCalculatePackageWeightTarget(orderWeightGrams);
    if (!target) return true;

    const lineBreak = document.createElement('span');
    lineBreak.id = 'vb-order-detail-package-weight-break';
    lineBreak.style.flexBasis = '100%';
    lineBreak.style.height = '0';
    lineBreak.style.marginTop = '-4px';

    shippingControls.append(lineBreak, vbCreatePackageWeightTarget(target));
    return true;
}

function vbInitOrderDetailPackageWeight() {
    if (vbInsertPackageWeightTarget()) return;

    const observer = new MutationObserver(() => {
        if (vbInsertPackageWeightTarget()) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', vbInitOrderDetailPackageWeight);
} else {
    vbInitOrderDetailPackageWeight();
}
