(function () {
    chrome.runtime.sendMessage({ type: 'vb-bricklink-store-session-cookie' }, response => {
        if (chrome.runtime.lastError) {
            console.warn('Vast Bricks: failed to request BrickLink cookie sync', chrome.runtime.lastError);
            return;
        }
        if (response && !response.ok) {
            console.warn('Vast Bricks: failed to store BrickLink session cookie', response.error || response.statusText);
        }
    });
})();
