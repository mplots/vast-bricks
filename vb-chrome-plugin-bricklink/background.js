const VB_PROD_API_BASE_URL = 'https://tool.vastbricks.com';
const VB_LOCAL_API_BASE_URL = 'http://127.0.0.1:6363';
const VB_BRICKLINK_EXPORT_URL = 'https://www.bricklink.com/orderExcelFinal.asp';
const VB_BRICKLINK_COOKIE_DOMAIN = 'bricklink.com';
const VB_BRICKLINK_REQUEST_FILTER = { urls: ['https://www.bricklink.com/*'] };
const VB_STORAGE_KEYS = {
    environment: 'vbApiEnvironment',
    apiBaseUrl: 'vbBrickSyncApiBaseUrl',
    apiKey: 'vbApiKey',
    prodApiKey: 'vbProdApiKey',
    localApiKey: 'vbLocalApiKey',
    // The key generated in the portal, which names the store it was generated for. Kept apart from the shared key
    // above because the two authenticate different halves of the platform: the legacy endpoints check the one
    // configured on the server, and the rewritten ones under /api/private/** check this one.
    vastProdApiKey: 'vbVastProdApiKey',
    vastLocalApiKey: 'vbVastLocalApiKey'
};
const VB_DEFAULTS = {
    prodApiKey: '',
    localApiKey: 'change-me'
};
let vbLastObservedBricklinkCookie = '';

function vbStorageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

async function vbApiBaseUrl() {
    const stored = await vbStorageGet(Object.values(VB_STORAGE_KEYS));
    return vbEnvironmentOf(stored) === 'local' ? VB_LOCAL_API_BASE_URL : VB_PROD_API_BASE_URL;
}

async function vbApiKey() {
    const stored = await vbStorageGet(Object.values(VB_STORAGE_KEYS));
    const environment = vbEnvironmentOf(stored);
    if (environment === 'local') {
        return stored[VB_STORAGE_KEYS.localApiKey] || VB_DEFAULTS.localApiKey;
    }
    return stored[VB_STORAGE_KEYS.prodApiKey] || stored[VB_STORAGE_KEYS.apiKey] || VB_DEFAULTS.prodApiKey;
}

/** The portal-generated key for the selected environment, or empty where the store has not pasted one in yet. */
async function vbVastApiKey() {
    const stored = await vbStorageGet(Object.values(VB_STORAGE_KEYS));
    const key = vbEnvironmentOf(stored) === 'local'
        ? stored[VB_STORAGE_KEYS.vastLocalApiKey]
        : stored[VB_STORAGE_KEYS.vastProdApiKey];
    return (key || '').trim();
}

function vbEnvironmentOf(stored) {
    return stored[VB_STORAGE_KEYS.environment]
        || (stored[VB_STORAGE_KEYS.apiBaseUrl] === VB_LOCAL_API_BASE_URL ? 'local' : 'prod');
}

function vbGetBricklinkCookies() {
    return Promise.all([
        vbGetCookies({ domain: VB_BRICKLINK_COOKIE_DOMAIN }),
        vbGetCookies({ url: VB_BRICKLINK_EXPORT_URL })
    ]).then(cookieGroups => vbMergeCookies(cookieGroups.flat()));
}

function vbGetCookies(details) {
    return new Promise((resolve, reject) => {
        chrome.cookies.getAll(details, cookies => {
            const error = chrome.runtime.lastError;
            if (error) {
                reject(new Error(error.message));
                return;
            }
            resolve(cookies || []);
        });
    });
}

function vbMergeCookies(cookies) {
    const merged = new Map();
    cookies.forEach(cookie => {
        if (!cookie || !cookie.name) {
            return;
        }
        merged.set(`${cookie.domain}|${cookie.path}|${cookie.name}`, cookie);
    });
    return Array.from(merged.values());
}

function vbBuildCookieHeader(cookies) {
    return cookies
        .filter(cookie => cookie && cookie.name && cookie.value !== undefined)
        .sort((a, b) => {
            const pathLength = (b.path || '').length - (a.path || '').length;
            if (pathLength !== 0) {
                return pathLength;
            }
            return a.name.localeCompare(b.name);
        })
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
}

async function vbStoreBricklinkSessionCookie() {
    const cookie = vbLastObservedBricklinkCookie || vbBuildCookieHeader(await vbGetBricklinkCookies());
    if (!cookie) {
        return { ok: false, status: 0, statusText: 'No BrickLink cookies found' };
    }

    return vbPostJson('/api/bricklink/session-cookie', { cookie });
}

function vbObserveBricklinkRequest(details) {
    const cookieHeader = (details.requestHeaders || [])
        .find(header => header.name && header.name.toLowerCase() === 'cookie');
    if (!cookieHeader || !cookieHeader.value) {
        return;
    }
    vbLastObservedBricklinkCookie = cookieHeader.value;
    vbPostJson('/api/bricklink/session-cookie', { cookie: cookieHeader.value })
        .catch(error => console.warn('Vast Bricks: failed to store observed BrickLink cookie', error));
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    vbObserveBricklinkRequest,
    VB_BRICKLINK_REQUEST_FILTER,
    ['requestHeaders', 'extraHeaders']
);

async function vbStoreBricklinkToken(token) {
    if (!token || !token.trim()) {
        return { ok: false, status: 0, statusText: 'No BrickLink token found' };
    }

    return vbPostJson('/api/bricklink/token', { token: token.trim() });
}

/**
 * Calls a rewritten endpoint under /api/private/** with the portal-generated key.
 *
 * <p>From here rather than from a content script because the key belongs to the extension, not to the BrickLink page
 * it happens to be reading, and because a request made here is not subject to the page's CORS - so the platform
 * needs no cross-origin allowance for BrickLink.
 *
 * <p>A store with no key configured is not an error worth reporting on every page: it has simply not set this up.
 */
async function vbVastRequest(path, options) {
    const apiKey = await vbVastApiKey();
    if (!apiKey) {
        return { ok: false, status: 0, statusText: 'No Vast API key configured', unconfigured: true, body: {} };
    }

    const response = await fetch(`${await vbApiBaseUrl()}${path}`, {
        ...options,
        headers: { ...(options && options.headers), 'X-Api-Key': apiKey }
    });
    return { ok: response.ok, status: response.status, statusText: response.statusText, body: await vbReadBody(response) };
}

/** The orders the platform is still missing a BrickLink VAT invoice for. */
function vbOutstandingVatInvoices() {
    return vbVastRequest('/api/private/vat-invoices/outstanding', { method: 'GET', headers: { Accept: 'application/json' } });
}

/** Hands one downloaded invoice over. The PDF travels as base64 because a message carries no bytes. */
function vbStoreVatInvoice(orderId, base64Pdf) {
    return vbVastRequest(`/api/private/vat-invoices/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', Accept: 'application/json' },
        body: Uint8Array.from(atob(base64Pdf), character => character.charCodeAt(0))
    });
}

async function vbReadBody(response) {
    const text = await response.text();
    if (!text) {
        return {};
    }
    try {
        return JSON.parse(text);
    } catch (_) {
        return { error: text };
    }
}

async function vbPostJson(path, requestBody) {
    const response = await fetch(`${await vbApiBaseUrl()}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': await vbApiKey()
        },
        body: JSON.stringify(requestBody)
    });

    return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: await vbReadBody(response)
    };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'vb-bricklink-store-session-cookie') {
        vbStoreBricklinkSessionCookie()
            .then(response => sendResponse(response))
            .catch(error => sendResponse({
                ok: false,
                status: 0,
                statusText: 'Request failed',
                body: { error: error.message },
                error: error.message
            }));
        return true;
    }

    if (message && message.type === 'vb-bricklink-store-token') {
        vbStoreBricklinkToken(message.token)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({
                ok: false,
                status: 0,
                statusText: 'Request failed',
                body: { error: error.message },
                error: error.message
            }));
        return true;
    }

    if (message && message.type === 'vb-vat-invoices-outstanding') {
        vbOutstandingVatInvoices()
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ ok: false, status: 0, statusText: error.message, body: {} }));
        return true;
    }

    if (message && message.type === 'vb-vat-invoice-store') {
        vbStoreVatInvoice(message.orderId, message.pdf)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ ok: false, status: 0, statusText: error.message, body: {} }));
        return true;
    }

    if (!message || message.type !== 'vb-bricksync-request') {
        return false;
    }

    fetch(message.url, message.options || {})
        .then(async response => {
            const text = await response.text();
            let body = {};
            if (text) {
                try {
                    body = JSON.parse(text);
                } catch (_) {
                    body = { error: text };
                }
            }
            sendResponse({
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                body
            });
        })
        .catch(error => {
            sendResponse({
                ok: false,
                status: 0,
                statusText: 'Request failed',
                body: { error: error.message }
            });
        });

    return true;
});
