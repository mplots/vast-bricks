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
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'))
        .filter(input => /ip/i.test(input.name || input.id || input.placeholder || ''));

    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.value = ipAddress;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

function colorNoticeableIpAddress() {
    Array.from(document.querySelectorAll('td, th, span, div, a'))
        .filter(element => element.childElementCount === 0 && element.textContent.includes(VB_NOTICEABLE_IP))
        .forEach(element => {
            element.style.background = '#fff3bf';
            element.style.color = '#7c2d12';
            element.style.fontWeight = '700';
            element.style.border = '3px solid #f59f00';
            element.style.borderRadius = '3px';
            element.style.padding = '2px 4px';
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
