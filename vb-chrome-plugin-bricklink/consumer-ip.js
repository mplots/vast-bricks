const VB_CURRENT_IP_API_URL = 'https://api.ipify.org?format=json';
const VB_NOTICEABLE_IP = '54.170.87.58';

async function fetchCurrentIpAddress() {
    const response = await fetch(VB_CURRENT_IP_API_URL);
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.ip;
}

function populateIpAddress(ipAddress) {
    const parts = String(ipAddress || '').trim().split('.');
    if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
        return;
    }

    const inputs = Array.from(document.querySelectorAll('input[name="allowIpToken"]'));
    if (inputs.length < 4) return;

    inputs.slice(0, 4).forEach((input, index) => {
        if (!input.value.trim()) {
            input.value = parts[index];
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

function colorNoticeableIpAddress() {
    Array.from(document.querySelectorAll('.access_token_list_item'))
        .filter(section => section.textContent.includes(VB_NOTICEABLE_IP))
        .forEach(section => {
            section.style.background = '#fff3bf';
            section.style.color = '#7c2d12';
            section.style.fontWeight = '700';
            section.style.border = '3px solid #f59f00';
            section.style.borderRadius = '4px';
            section.style.padding = '6px';
            section.style.margin = '4px 0';
            section.style.boxShadow = '0 0 0 2px rgba(245, 159, 0, 0.22)';

            const table = section.querySelector('table');
            if (table) {
                table.style.background = 'transparent';
            }
        });
}

async function initConsumerIp() {
    colorNoticeableIpAddress();
    try {
        populateIpAddress(await fetchCurrentIpAddress());
    } catch (error) {
        console.warn('Vast Bricks: failed to populate current IP address', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsumerIp);
} else {
    initConsumerIp();
}
