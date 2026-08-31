(function () {
    const TOKEN_INPUT_SELECTOR = '.bl-access-token-group__input-field';
    const TOKEN_ACTION_LABELS = new Set(['Renew Token', 'Generate Token']);
    const MANUAL_SYNC_ID = 'vb-brickstore-token-sync';
    const MIN_TOKEN_LENGTH = 40;
    const WAIT_TIMEOUT_MS = 15000;
    const POLL_INTERVAL_MS = 250;
    let lastSentToken = '';
    const tokenStoreRequests = new Map();
    let pendingObserver = null;
    let pendingInterval = null;
    let pendingTimeout = null;
    let manualSyncScheduled = false;

    function normalize(text) {
        return String(text || '').trim().replace(/\s+/g, ' ');
    }

    function findTokenInput() {
        const knownInput = document.querySelector(TOKEN_INPUT_SELECTOR);
        if (knownInput) {
            return knownInput;
        }

        return Array.from(document.querySelectorAll('input'))
            .find(input => looksLikeToken(input.value?.trim() || ''));
    }

    function readToken() {
        return findTokenInput()?.value?.trim() || '';
    }

    function findActionByLabel(label) {
        return Array.from(document.querySelectorAll('button, [role="button"]'))
            .find(action => normalize(action.textContent) === label);
    }

    function looksLikeToken(token) {
        return token.length >= MIN_TOKEN_LENGTH && /^[A-Za-z0-9._~-]+$/.test(token);
    }

    function storeToken(token) {
        if (tokenStoreRequests.has(token)) {
            return tokenStoreRequests.get(token);
        }

        const request = new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'vb-bricklink-store-token', token }, response => {
                if (chrome.runtime.lastError) {
                    resolve({
                        ok: false,
                        status: 0,
                        statusText: chrome.runtime.lastError.message || 'Extension request failed'
                    });
                    return;
                }
                resolve(response || { ok: false, status: 0, statusText: 'No response from Vast Bricks' });
            });
        }).finally(() => {
            tokenStoreRequests.delete(token);
        });

        tokenStoreRequests.set(token, request);
        return request;
    }

    function sendToken(token) {
        if (!looksLikeToken(token) || token === lastSentToken) {
            return;
        }
        lastSentToken = token;
        storeToken(token).then(response => {
            if (!response.ok) {
                console.warn('Vast Bricks: failed to store generated BrickLink token', response.statusText);
            }
        });
    }

    function setManualSyncStatus(status, text) {
        const statusElement = document.querySelector(`#${MANUAL_SYNC_ID} + [data-vb-token-sync-status]`);
        if (!statusElement) {
            return;
        }

        statusElement.textContent = text;
        statusElement.dataset.status = status;
    }

    async function sendExistingToken(button) {
        const token = readToken();
        if (!looksLikeToken(token)) {
            setManualSyncStatus('error', 'No valid BrickLink token is available.');
            return;
        }

        button.disabled = true;
        setManualSyncStatus('pending', 'Sending token…');
        const response = await storeToken(token);
        button.disabled = false;

        if (response.ok) {
            lastSentToken = token;
            setManualSyncStatus('success', 'Token sent to Vast Bricks.');
            return;
        }
        setManualSyncStatus('error', `Token was not sent${response.status ? ` (HTTP ${response.status})` : ''}.`);
    }

    function addManualSyncControl() {
        const input = findTokenInput();
        if (!input || document.getElementById(MANUAL_SYNC_ID)) {
            return Boolean(document.getElementById(MANUAL_SYNC_ID));
        }

        const copyTokenButton = findActionByLabel('Copy to Clipboard');
        const anchor = copyTokenButton || input.closest('.bl-access-token-group') || input.parentElement;
        if (!anchor) {
            return false;
        }

        const button = document.createElement('button');
        button.id = MANUAL_SYNC_ID;
        button.type = 'button';
        button.textContent = 'Send token to Vast Bricks';
        if (copyTokenButton) {
            button.className = copyTokenButton.className;
            button.style.marginLeft = '12px';
        } else {
            button.style.cssText = 'padding:8px 14px;border-radius:5px;color:#ffffff;cursor:pointer;';
        }
        button.style.setProperty('background-color', '#00824b', 'important');
        button.style.setProperty('border-color', '#00824b', 'important');
        button.addEventListener('click', () => sendExistingToken(button));

        const status = document.createElement('span');
        status.dataset.vbTokenSyncStatus = '';
        status.setAttribute('aria-live', 'polite');
        status.style.cssText = 'margin-left:8px;font-size:12px;';

        anchor.insertAdjacentElement('afterend', button);
        button.insertAdjacentElement('afterend', status);
        return true;
    }

    function clearPendingWatch() {
        if (pendingObserver) {
            pendingObserver.disconnect();
            pendingObserver = null;
        }
        if (pendingInterval) {
            clearInterval(pendingInterval);
            pendingInterval = null;
        }
        if (pendingTimeout) {
            clearTimeout(pendingTimeout);
            pendingTimeout = null;
        }
    }

    function waitForChangedToken(previousToken) {
        clearPendingWatch();

        const trySendChangedToken = () => {
            const token = readToken();
            if (!looksLikeToken(token) || token === previousToken) {
                return false;
            }
            clearPendingWatch();
            sendToken(token);
            return true;
        };

        if (trySendChangedToken()) {
            return;
        }

        pendingObserver = new MutationObserver(trySendChangedToken);
        pendingObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['value', 'class', 'type']
        });

        pendingInterval = setInterval(trySendChangedToken, POLL_INTERVAL_MS);
        pendingTimeout = setTimeout(clearPendingWatch, WAIT_TIMEOUT_MS);
    }

    function isTokenActionButton(element) {
        return element instanceof HTMLButtonElement
            && TOKEN_ACTION_LABELS.has(normalize(element.textContent));
    }

    document.addEventListener('click', event => {
        const button = event.target?.closest?.('button');
        if (!isTokenActionButton(button)) {
            return;
        }
        waitForChangedToken(readToken());
    }, true);

    function scheduleManualSyncControl() {
        if (manualSyncScheduled) {
            return;
        }

        manualSyncScheduled = true;
        requestAnimationFrame(() => {
            manualSyncScheduled = false;
            addManualSyncControl();
        });
    }

    // BrickLink renders this screen with React. Keep watching so a component
    // replacement cannot remove the extension control after it has been added.
    const manualSyncObserver = new MutationObserver(scheduleManualSyncControl);
    manualSyncObserver.observe(document.documentElement, { childList: true, subtree: true });
    scheduleManualSyncControl();
})();
