(function () {
    const TOKEN_INPUT_SELECTOR = '.bl-access-token-group__input-field';
    const TOKEN_ACTION_LABELS = new Set(['Renew Token', 'Generate Token']);
    const MIN_TOKEN_LENGTH = 40;
    const WAIT_TIMEOUT_MS = 15000;
    const POLL_INTERVAL_MS = 250;
    let lastSentToken = '';
    let pendingObserver = null;
    let pendingInterval = null;
    let pendingTimeout = null;

    function normalize(text) {
        return String(text || '').trim().replace(/\s+/g, ' ');
    }

    function findTokenInput() {
        return document.querySelector(TOKEN_INPUT_SELECTOR);
    }

    function readToken() {
        return findTokenInput()?.value?.trim() || '';
    }

    function looksLikeToken(token) {
        return token.length >= MIN_TOKEN_LENGTH && /^[A-Za-z0-9._~-]+$/.test(token);
    }

    function sendToken(token) {
        if (!looksLikeToken(token) || token === lastSentToken) {
            return;
        }
        lastSentToken = token;
        chrome.runtime.sendMessage({ type: 'vb-bricklink-store-token', token }, response => {
            if (chrome.runtime.lastError) {
                console.warn('Vast Bricks: failed to request BrickLink token sync', chrome.runtime.lastError);
                return;
            }
            if (response && !response.ok) {
                console.warn('Vast Bricks: failed to store BrickLink token', response.body?.error || response.statusText);
            }
        });
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
})();
