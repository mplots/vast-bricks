chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
