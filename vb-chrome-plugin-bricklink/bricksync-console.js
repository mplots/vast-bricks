(function () {
    const PROD_API_BASE_URL = 'https://tool.vastbricks.com';
    const LOCAL_API_BASE_URL = 'http://127.0.0.1:6161';
    const STORAGE_KEYS = {
        environment: 'vbApiEnvironment',
        apiBaseUrl: 'vbBrickSyncApiBaseUrl',
        apiKey: 'vbBrickSyncApiKey',
        prodApiKey: 'vbBrickSyncProdApiKey',
        localApiKey: 'vbBrickSyncLocalApiKey',
        tail: 'vbBrickSyncTail',
        hidden: 'vbBrickSyncHidden',
        panelLeft: 'vbBrickSyncPanelLeft',
        panelTop: 'vbBrickSyncPanelTop',
        panelWidth: 'vbBrickSyncPanelWidth',
        panelHeight: 'vbBrickSyncPanelHeight'
    };
    const TOOLS_VISIBILITY_EVENT = 'vb-bricklink-tools-visibility-change';

    const defaults = {
        environment: 'prod',
        apiBaseUrl: PROD_API_BASE_URL,
        apiKey: 'jaidaisae5AiW1ain2',
        localApiKey: 'change-me',
        tail: '200',
        hidden: true,
        pollMs: 2500,
        panelWidth: '420px',
        panelHeight: '420px'
    };

    const expandedWidth = defaults.panelWidth;
    const hiddenWidth = '166px';
    const compactHeight = '82px';
    const floatingPanelRight = '66px';
    const masterPanelBottom = '14px';
    const expandedPanelBottom = '104px';

    function storageGet(keys) {
        return new Promise(resolve => chrome.storage.local.get(keys, resolve));
    }

    function storageSet(values) {
        return new Promise(resolve => chrome.storage.local.set(values, resolve));
    }

    async function loadSettings() {
        const stored = await storageGet(Object.values(STORAGE_KEYS));
        const environment = stored[STORAGE_KEYS.environment]
            || (stored[STORAGE_KEYS.apiBaseUrl] === LOCAL_API_BASE_URL ? 'local' : defaults.environment);
        const prodApiKey = stored[STORAGE_KEYS.prodApiKey] || stored[STORAGE_KEYS.apiKey] || defaults.apiKey;
        const localApiKey = stored[STORAGE_KEYS.localApiKey] || defaults.localApiKey;
        return {
            environment,
            apiBaseUrl: apiBaseUrlForEnvironment(environment),
            apiKey: environment === 'local' ? localApiKey : prodApiKey,
            prodApiKey,
            localApiKey,
            tail: stored[STORAGE_KEYS.tail] || defaults.tail,
            hidden: stored[STORAGE_KEYS.hidden] === undefined ? defaults.hidden : Boolean(stored[STORAGE_KEYS.hidden]),
            panelLeft: stored[STORAGE_KEYS.panelLeft],
            panelTop: stored[STORAGE_KEYS.panelTop],
            panelWidth: stored[STORAGE_KEYS.panelWidth] || defaults.panelWidth,
            panelHeight: stored[STORAGE_KEYS.panelHeight] || defaults.panelHeight
        };
    }

    function saveSettings(settings) {
        const environmentApiKeyStorageKey = settings.environment === 'local'
            ? STORAGE_KEYS.localApiKey
            : STORAGE_KEYS.prodApiKey;
        return storageSet({
            [STORAGE_KEYS.environment]: settings.environment,
            [STORAGE_KEYS.apiBaseUrl]: settings.apiBaseUrl,
            [STORAGE_KEYS.apiKey]: settings.apiKey,
            [environmentApiKeyStorageKey]: settings.apiKey,
            [STORAGE_KEYS.tail]: settings.tail
        });
    }

    function apiBaseUrlForEnvironment(environment) {
        return environment === 'local' ? LOCAL_API_BASE_URL : PROD_API_BASE_URL;
    }

    function saveHidden(hidden) {
        return storageSet({ [STORAGE_KEYS.hidden]: hidden });
    }

    function savePanelLayout(panel) {
        return storageSet({
            [STORAGE_KEYS.panelLeft]: panel.style.left,
            [STORAGE_KEYS.panelTop]: panel.style.top,
            [STORAGE_KEYS.panelWidth]: panel.style.width,
            [STORAGE_KEYS.panelHeight]: panel.style.height
        });
    }

    function createElement(tag, styles, text) {
        const element = document.createElement(tag);
        Object.assign(element.style, styles || {});
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }

    function createEnvironmentControl(environment) {
        const element = createElement('div', {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            width: '100%',
            whiteSpace: 'nowrap'
        });
        const text = createElement('span', {
            color: '#e5e7eb',
            fontWeight: '700'
        }, 'DEV Mode');
        const switchElement = createElement('label', {
            position: 'relative',
            display: 'inline-flex',
            width: '46px',
            height: '26px',
            flex: '0 0 auto',
            cursor: 'pointer'
        });
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = environment === 'local';
        input.setAttribute('aria-label', 'Enable Dev Mode');
        Object.assign(input.style, {
            position: 'absolute',
            opacity: '0',
            width: '1px',
            height: '1px'
        });
        const track = createElement('span', {
            position: 'absolute',
            inset: '0',
            borderRadius: '999px',
            cursor: 'pointer',
            transition: 'background 140ms ease'
        });
        const thumb = createElement('span', {
            position: 'absolute',
            width: '22px',
            height: '22px',
            left: '2px',
            top: '2px',
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.36)',
            transition: 'transform 140ms ease'
        });
        switchElement.append(input, track, thumb);
        element.append(text, switchElement);
        return { element, input, track, thumb };
    }

    async function requestJson(url, options) {
        const response = await chrome.runtime.sendMessage({
            type: 'vb-bricksync-request',
            url,
            options
        });
        if (!response || !response.ok) {
            const body = response?.body || {};
            throw new Error(body.error || `${response?.status || 0} ${response?.statusText || 'Request failed'}`);
        }
        return response.body;
    }

    async function ensureBrickSyncConsole() {
        if (document.getElementById('vb-bricksync-console')) return;

        const settings = await loadSettings();

        const panel = createElement('div', {
            position: 'fixed',
            right: floatingPanelRight,
            bottom: expandedPanelBottom,
            zIndex: '2147483647',
            width: expandedWidth,
            height: defaults.panelHeight,
            minWidth: '320px',
            minHeight: '280px',
            maxWidth: 'calc(100vw - 28px)',
            maxHeight: 'calc(100vh - 28px)',
            background: '#111827',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            resize: 'both',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed'
        });
        panel.id = 'vb-bricksync-console';

        const masterPanel = createElement('div', {
            position: 'fixed',
            right: floatingPanelRight,
            bottom: masterPanelBottom,
            zIndex: '2147483647',
            width: hiddenWidth,
            height: compactHeight,
            maxWidth: 'calc(100vw - 28px)',
            background: '#111827',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.32)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '12px',
            boxSizing: 'border-box',
            padding: '8px 10px'
        });
        masterPanel.id = 'vb-bricksync-master-mode';
        const masterContent = createElement('div', {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            height: '64px'
        });
        const masterText = createElement('span', {
            color: '#e5e7eb',
            fontWeight: '700',
            whiteSpace: 'nowrap'
        }, 'BL Master');
        const masterSwitch = createElement('label', {
            position: 'relative',
            display: 'inline-flex',
            width: '46px',
            height: '26px',
            flex: '0 0 auto'
        });
        const masterInput = document.createElement('input');
        masterInput.type = 'checkbox';
        Object.assign(masterInput.style, {
            position: 'absolute',
            opacity: '0',
            width: '1px',
            height: '1px'
        });
        const masterTrack = createElement('span', {
            position: 'absolute',
            inset: '0',
            borderRadius: '999px',
            background: '#4b5563',
            cursor: 'pointer',
            transition: 'background 140ms ease, opacity 140ms ease'
        });
        const masterThumb = createElement('span', {
            position: 'absolute',
            width: '22px',
            height: '22px',
            left: '2px',
            top: '2px',
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.36)',
            transition: 'transform 140ms ease'
        });
        masterSwitch.append(masterInput, masterTrack, masterThumb);
        const masterModeControl = createElement('div', {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: '8px'
        });
        masterModeControl.append(masterText, masterSwitch);
        const menuEnvironment = createEnvironmentControl(settings.environment);
        masterContent.append(masterModeControl, menuEnvironment.element);
        masterPanel.append(masterContent);
        masterPanel.title = 'BrickLink Master Mode';
        ensureSpinnerStyle();

        const compactMasterSwitch = createElement('label', {
            position: 'relative',
            display: 'none',
            width: '46px',
            height: '26px',
            flex: '0 0 auto'
        });
        const compactMasterInput = document.createElement('input');
        compactMasterInput.type = 'checkbox';
        Object.assign(compactMasterInput.style, {
            position: 'absolute',
            opacity: '0',
            width: '1px',
            height: '1px'
        });
        const compactMasterTrack = createElement('span', {
            position: 'absolute',
            inset: '0',
            borderRadius: '999px',
            background: '#4b5563',
            cursor: 'pointer',
            transition: 'background 140ms ease, opacity 140ms ease'
        });
        const compactMasterThumb = createElement('span', {
            position: 'absolute',
            width: '22px',
            height: '22px',
            left: '2px',
            top: '2px',
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.36)',
            transition: 'transform 140ms ease'
        });
        compactMasterSwitch.append(compactMasterInput, compactMasterTrack, compactMasterThumb);
        const compactEnvironment = createEnvironmentControl(settings.environment);
        compactEnvironment.element.style.display = 'none';

        const header = createElement('div', {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 10px',
            borderBottom: '1px solid #374151',
            cursor: 'move',
            userSelect: 'none',
            flex: '0 0 auto',
            position: 'relative'
        });

        const closeButton = createElement('button', iconButtonStyle(), '×');
        closeButton.title = 'Minimize BrickSync';
        const title = createElement('strong', {
            fontSize: '12px',
            flex: '1 1 auto'
        }, 'BrickSync');
        const openConsoleButton = createElement('button', tinyIconButtonStyle(), '>_');
        openConsoleButton.title = 'Open BrickSync console';
        const headerActions = createElement('div', { display: 'flex', gap: '6px' });
        const resetButton = createElement('button', buttonStyle(), 'Reset');
        resetButton.title = 'Reset BrickSync window position and size';
        const settingsButton = createElement('button', buttonStyle(), 'Settings');
        headerActions.append(resetButton, settingsButton);
        header.append(closeButton, title, compactMasterSwitch, compactEnvironment.element, headerActions);

        const body = createElement('div', {
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flex: '1 1 auto',
            minHeight: '0',
            boxSizing: 'border-box'
        });

        const settingsPanel = createElement('div', {
            display: 'none',
            gap: '6px',
            gridTemplateColumns: '1fr 100px'
        });
        const environmentRow = createElement('div', {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            gridColumn: '1 / -1',
            padding: '2px 0 4px'
        });
        const settingsEnvironment = createEnvironmentControl(settings.environment);
        const environmentInput = settingsEnvironment.input;
        environmentRow.append(settingsEnvironment.element);
        const apiBaseInput = input('API URL', settings.apiBaseUrl);
        apiBaseInput.readOnly = true;
        apiBaseInput.title = 'Selected by Dev Mode';
        const tailInput = input('Log lines', settings.tail);
        tailInput.type = 'number';
        tailInput.min = '1';
        tailInput.title = 'Number of recent BrickSync log lines to display';
        const keyInput = input('API key', settings.apiKey);
        keyInput.type = 'password';
        settingsPanel.append(environmentRow, apiBaseInput, tailInput, keyInput);

        const status = createElement('div', { minHeight: '16px', color: '#9ca3af' }, '');
        const logOutput = createElement('pre', {
            margin: '0',
            padding: '8px',
            flex: '1 1 auto',
            minHeight: '80px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#030712',
            color: '#d1d5db',
            border: '1px solid #374151',
            borderRadius: '4px',
            font: '11px Menlo, Consolas, monospace'
        });

        const commandRow = createElement('div', {
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '6px',
            flex: '0 0 auto'
        });
        const commandInput = input('Command', '');
        const sendButton = createElement('button', buttonStyle(), 'Send');
        commandRow.append(commandInput, sendButton);

        body.append(settingsPanel, status, logOutput, commandRow);
        panel.append(header, body);
        panel.append(openConsoleButton);
        document.body.appendChild(masterPanel);
        document.body.appendChild(panel);

        let pollTimer = null;
        let pollInFlight = false;
        let masterState = 'unknown';
        let masterPendingState = null;
        let toolsOpen = document.documentElement.dataset.vbBrickLinkToolsOpen === 'true';
        let resizeSaveTimer = null;
        let dragState = null;
        let masterStatusCheckInFlight = false;
        let masterStatusGeneration = 0;
        let awaitingMasterStatusOutput = false;
        let masterStatusLoading = false;
        let hiddenState = settings.hidden;

        restorePanelLayout(settings);
        applyHidden(settings.hidden);
        applyToolsVisibility(toolsOpen);

        function currentSettings() {
            const environment = environmentInput.checked ? 'local' : 'prod';
            return {
                environment,
                apiBaseUrl: apiBaseUrlForEnvironment(environment),
                apiKey: keyInput.value,
                tail: tailInput.value.trim() || defaults.tail
            };
        }

        function renderEnvironmentSwitch() {
            const local = environmentInput.checked;
            [settingsEnvironment, menuEnvironment, compactEnvironment].forEach(control => {
                control.input.checked = local;
                control.track.style.background = local ? '#f59e0b' : '#4b5563';
                control.thumb.style.transform = local ? 'translateX(20px)' : 'translateX(0)';
                control.element.title = local ? LOCAL_API_BASE_URL : PROD_API_BASE_URL;
            });
            apiBaseInput.value = apiBaseUrlForEnvironment(local ? 'local' : 'prod');
        }

        async function selectEnvironment(local) {
            const previousEnvironment = settings.environment;
            if (previousEnvironment === 'local') {
                settings.localApiKey = keyInput.value;
            } else {
                settings.prodApiKey = keyInput.value;
            }
            await storageSet({
                [previousEnvironment === 'local' ? STORAGE_KEYS.localApiKey : STORAGE_KEYS.prodApiKey]: keyInput.value
            });

            environmentInput.checked = local;
            renderEnvironmentSwitch();
            keyInput.value = local ? settings.localApiKey : settings.prodApiKey;
            const current = currentSettings();
            settings.environment = current.environment;
            settings.apiBaseUrl = current.apiBaseUrl;

            masterStatusGeneration += 1;
            masterStatusCheckInFlight = false;
            awaitingMasterStatusOutput = false;
            masterStatusLoading = false;
            masterPendingState = null;
            masterState = 'unknown';
            renderMasterState();

            await saveSettings(current);
            status.textContent = `Dev Mode: ${local ? 'On' : 'Off'}; checking BL Master...`;
            if (toolsOpen) {
                await requestMasterStatus();
            }
        }

        function applyHidden(hidden) {
            if (hidden && !hiddenState) {
                capturePanelLayout();
                savePanelLayout(panel);
            }
            hiddenState = hidden;
            body.style.display = hidden ? 'none' : 'flex';
            closeButton.style.display = hidden ? 'none' : '';
            openConsoleButton.style.display = hidden ? '' : 'none';
            compactMasterSwitch.style.display = hidden ? 'inline-flex' : 'none';
            compactEnvironment.element.style.display = hidden ? 'flex' : 'none';
            resetButton.style.display = hidden ? 'none' : '';
            settingsButton.style.display = hidden ? 'none' : '';
            headerActions.style.display = hidden ? 'none' : 'flex';
            header.style.borderBottom = hidden ? '0' : '1px solid #374151';
            header.style.cursor = hidden ? 'default' : 'move';
            header.style.gap = '8px';
            if (hidden) {
                title.textContent = 'BL Master';
                title.style.position = 'absolute';
                title.style.left = '34px';
                title.style.top = '17px';
                title.style.paddingLeft = '0';
                title.style.flex = '0 0 auto';
                compactMasterSwitch.style.position = 'absolute';
                compactMasterSwitch.style.right = '10px';
                compactMasterSwitch.style.top = '10px';
                compactEnvironment.element.style.position = 'absolute';
                compactEnvironment.element.style.width = 'auto';
                compactEnvironment.element.style.left = '34px';
                compactEnvironment.element.style.right = '10px';
                compactEnvironment.element.style.top = '46px';
                panel.style.left = '';
                panel.style.top = '';
                panel.style.right = floatingPanelRight;
                panel.style.bottom = masterPanelBottom;
                panel.style.width = hiddenWidth;
                panel.style.height = compactHeight;
                panel.style.minWidth = hiddenWidth;
                panel.style.minHeight = compactHeight;
                panel.style.maxWidth = hiddenWidth;
                panel.style.maxHeight = compactHeight;
                panel.style.resize = 'none';
                settingsPanel.style.display = 'none';
            } else {
                title.textContent = 'BrickSync';
                title.style.position = '';
                title.style.left = '';
                title.style.top = '';
                title.style.paddingLeft = '0';
                title.style.flex = '1 1 auto';
                compactMasterSwitch.style.position = 'relative';
                compactMasterSwitch.style.right = '';
                compactMasterSwitch.style.top = '';
                compactEnvironment.element.style.position = '';
                compactEnvironment.element.style.width = '100%';
                compactEnvironment.element.style.left = '';
                compactEnvironment.element.style.right = '';
                compactEnvironment.element.style.top = '';
                panel.style.minWidth = '320px';
                panel.style.minHeight = '280px';
                panel.style.maxWidth = 'calc(100vw - 28px)';
                panel.style.maxHeight = 'calc(100vh - 28px)';
                panel.style.resize = 'both';
                restorePanelLayout(settings);
            }
        }

        function resetPanelLayout() {
            settings.panelLeft = '';
            settings.panelTop = '';
            settings.panelWidth = defaults.panelWidth;
            settings.panelHeight = defaults.panelHeight;
            panel.style.left = '';
            panel.style.top = '';
            panel.style.right = floatingPanelRight;
            panel.style.bottom = expandedPanelBottom;
            panel.style.width = defaults.panelWidth;
            panel.style.height = defaults.panelHeight;
            savePanelLayout(panel);
        }

        function restorePanelLayout(current) {
            panel.style.width = current.panelWidth || defaults.panelWidth;
            panel.style.height = current.panelHeight || defaults.panelHeight;
            if (current.panelLeft && current.panelTop) {
                panel.style.left = current.panelLeft;
                panel.style.top = current.panelTop;
                panel.style.right = '';
                panel.style.bottom = '';
                keepPanelInViewport();
            } else {
                panel.style.left = '';
                panel.style.top = '';
                panel.style.right = floatingPanelRight;
                panel.style.bottom = expandedPanelBottom;
            }
        }

        function keepPanelInViewport() {
            const rect = panel.getBoundingClientRect();
            const maxLeft = Math.max(14, window.innerWidth - rect.width - 14);
            const maxTop = Math.max(14, window.innerHeight - rect.height - 14);
            const left = Math.min(Math.max(rect.left, 14), maxLeft);
            const top = Math.min(Math.max(rect.top, 14), maxTop);
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.right = '';
            panel.style.bottom = '';
        }

        function schedulePanelLayoutSave() {
            if (body.style.display === 'none') return;
            window.clearTimeout(resizeSaveTimer);
            resizeSaveTimer = window.setTimeout(() => {
                keepPanelInViewport();
                capturePanelLayout();
                savePanelLayout(panel);
            }, 250);
        }

        function capturePanelLayout() {
            settings.panelLeft = panel.style.left;
            settings.panelTop = panel.style.top;
            settings.panelWidth = panel.style.width;
            settings.panelHeight = panel.style.height;
        }

        function startPanelDrag(event) {
            if (body.style.display === 'none' || event.target.closest('button,input,label')) return;

            const rect = panel.getBoundingClientRect();
            dragState = {
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = '';
            panel.style.bottom = '';
            document.addEventListener('pointermove', dragPanel);
            document.addEventListener('pointerup', stopPanelDrag, { once: true });
        }

        function dragPanel(event) {
            if (!dragState) return;

            const rect = panel.getBoundingClientRect();
            const left = Math.min(
                Math.max(event.clientX - dragState.offsetX, 14),
                Math.max(14, window.innerWidth - rect.width - 14)
            );
            const top = Math.min(
                Math.max(event.clientY - dragState.offsetY, 14),
                Math.max(14, window.innerHeight - rect.height - 14)
            );
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
        }

        function stopPanelDrag() {
            if (!dragState) return;
            dragState = null;
            document.removeEventListener('pointermove', dragPanel);
            schedulePanelLayoutSave();
        }

        function applyToolsVisibility(open) {
            toolsOpen = open;
            panel.style.display = open ? 'flex' : 'none';
            masterPanel.style.display = open && !hiddenState ? 'block' : 'none';
            if (open) {
                startPolling(false);
                requestMasterStatus().catch(error => status.textContent = error.message);
            } else {
                awaitingMasterStatusOutput = false;
                stopPolling();
            }
        }

        async function refreshLogs() {
            if (pollInFlight) return;
            pollInFlight = true;
            const current = currentSettings();
            try {
                await saveSettings(current);
                const body = await requestJson(`${current.apiBaseUrl}/api/bricksync/logs?tail=${encodeURIComponent(current.tail)}`, {
                    headers: { 'X-Bricksync-Key': current.apiKey }
                });
                if (currentSettings().apiBaseUrl !== current.apiBaseUrl) return;
                const logs = body.logs || '';
                updateMasterState(logs);
                if (document.body.contains(logOutput)) {
                    const wasNearBottom = isScrolledNearBottom(logOutput);
                    const previousScrollTop = logOutput.scrollTop;
                    renderAnsiLogs(logOutput, logs);
                    logOutput.scrollTop = wasNearBottom ? logOutput.scrollHeight : previousScrollTop;
                }
                status.textContent = `Logs: ${new Date().toLocaleTimeString()}`;
            } catch (error) {
                if (currentSettings().apiBaseUrl !== current.apiBaseUrl) return;
                markMasterStateUnavailable();
                throw error;
            } finally {
                pollInFlight = false;
            }
        }

        function isScrolledNearBottom(element) {
            return element.scrollHeight - element.scrollTop - element.clientHeight < 24;
        }

        function startPolling(refreshImmediately = true) {
            if (pollTimer) return;
            if (refreshImmediately) {
                refreshLogs().catch(error => status.textContent = error.message);
            }
            pollTimer = window.setInterval(() => {
                refreshLogs().catch(error => status.textContent = error.message);
            }, defaults.pollMs);
        }

        function stopPolling() {
            if (!pollTimer) return;
            window.clearInterval(pollTimer);
            pollTimer = null;
        }

        async function sendBrickSyncCommand(command, options = {}) {
            if (!command) return;

            const current = currentSettings();
            await saveSettings(current);
            if (!options.quiet) {
                status.textContent = `Sending: ${command}`;
            }
            await requestJson(`${current.apiBaseUrl}/api/bricksync/commands`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Bricksync-Key': current.apiKey
                },
                body: JSON.stringify({ command })
            });
        }

        async function requestMasterStatus() {
            if (!toolsOpen || masterStatusCheckInFlight) return;

            const generation = masterStatusGeneration;
            masterStatusCheckInFlight = true;
            awaitingMasterStatusOutput = true;
            masterStatusLoading = true;
            renderMasterState();
            try {
                await sendBrickSyncCommand('status', { quiet: true });
                if (generation !== masterStatusGeneration) return;
                window.setTimeout(() => {
                    if (toolsOpen && generation === masterStatusGeneration) {
                        refreshLogs().catch(error => status.textContent = error.message);
                    }
                }, 500);
            } catch (error) {
                if (generation !== masterStatusGeneration) return;
                awaitingMasterStatusOutput = false;
                masterStatusLoading = false;
                masterState = 'unknown';
                renderMasterState();
                throw error;
            } finally {
                if (generation === masterStatusGeneration) {
                    masterStatusCheckInFlight = false;
                }
            }
        }

        async function sendCommand() {
            const command = commandInput.value.trim();
            if (!command) return;

            await sendBrickSyncCommand(command);
            commandInput.value = '';
            status.textContent = `Sent: ${command}`;
            await refreshLogs();
        }

        async function toggleMasterMode() {
            if (masterState === 'unknown') {
                status.textContent = 'Master mode state is not visible in logs yet';
                return;
            }

            const nextState = masterPendingState || (masterState === 'on' ? 'off' : 'on');
            const command = nextState === 'on' ? 'blmaster on' : 'blmaster off';
            masterPendingState = nextState;
            renderMasterState();

            try {
                await sendBrickSyncCommand(command);
                status.textContent = `Sent: ${command}`;
                await refreshLogs();
            } catch (error) {
                masterPendingState = null;
                renderMasterState();
                throw error;
            }
        }

        function updateMasterState(logs) {
            const parsedState = parseBrickLinkMasterState(logs);
            if (awaitingMasterStatusOutput) {
                masterState = parsedState === 'on' ? 'on' : 'off';
                awaitingMasterStatusOutput = false;
                masterStatusLoading = false;
            } else if (parsedState !== 'unknown') {
                masterState = parsedState;
                masterStatusLoading = false;
            }
            if (masterPendingState && masterState === masterPendingState) {
                masterPendingState = null;
            }
            renderMasterState();
        }

        function markMasterStateUnavailable() {
            if (masterPendingState) return;
            masterState = 'unknown';
            masterStatusLoading = false;
            renderMasterState();
        }

        function renderMasterState() {
            const visibleState = masterPendingState || masterState;
            const loading = Boolean(masterPendingState) || masterStatusLoading;
            const disabled = loading || masterState === 'unknown';

            renderMasterSwitch(masterInput, masterSwitch, masterTrack, masterThumb, visibleState, loading, disabled);
            renderMasterSwitch(
                compactMasterInput,
                compactMasterSwitch,
                compactMasterTrack,
                compactMasterThumb,
                visibleState,
                loading,
                disabled
            );

            if (loading) {
                masterPanel.title = masterPendingState
                    ? 'Waiting for BrickSync logs to confirm the new mode'
                    : 'Loading BrickLink Master Mode status';
                return;
            }
            if (masterState === 'on') {
                masterPanel.title = 'BrickLink Master Mode is on. Click to send: blmaster off';
                return;
            }
            if (masterState === 'off') {
                masterPanel.title = 'BrickLink Master Mode is off. Click to send: blmaster on';
                return;
            }
            masterPanel.title = 'Run blmaster in BrickSync or wait for logs to show the current mode';
        }

        function renderMasterSwitch(inputElement, switchElement, trackElement, thumbElement, visibleState, loading, disabled) {
            inputElement.checked = visibleState === 'on';
            inputElement.disabled = disabled;
            thumbElement.style.transform = visibleState === 'on' ? 'translateX(20px)' : 'translateX(0)';
            trackElement.style.background = masterState === 'unknown' && !loading
                ? '#dc2626'
                : visibleState === 'on' ? '#34c759' : '#4b5563';
            trackElement.style.opacity = disabled ? '0.45' : '1';
            trackElement.style.cursor = disabled ? 'default' : 'pointer';
            switchElement.style.cursor = disabled ? 'default' : 'pointer';
            thumbElement.style.background = '#ffffff';
            thumbElement.style.border = '0';
            thumbElement.style.boxSizing = 'border-box';
            thumbElement.style.animation = '';

            if (!loading) return;

            thumbElement.style.background = 'transparent';
            thumbElement.style.border = '3px solid #ffffff';
            thumbElement.style.borderTopColor = 'rgba(255,255,255,0.25)';
            thumbElement.style.animation = visibleState === 'on'
                ? 'vbBrickSyncSpinOn 700ms linear infinite'
                : 'vbBrickSyncSpinOff 700ms linear infinite';
        }

        sendButton.addEventListener('click', () => sendCommand().catch(error => status.textContent = error.message));
        commandInput.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            sendCommand().catch(error => status.textContent = error.message);
        });
        settingsButton.addEventListener('click', () => {
            settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'grid' : 'none';
        });
        environmentInput.addEventListener('change', () => selectEnvironment(environmentInput.checked)
            .catch(error => status.textContent = error.message));
        menuEnvironment.input.addEventListener('change', () => selectEnvironment(menuEnvironment.input.checked)
            .catch(error => status.textContent = error.message));
        compactEnvironment.input.addEventListener('change', () => selectEnvironment(compactEnvironment.input.checked)
            .catch(error => status.textContent = error.message));
        closeButton.addEventListener('click', () => {
            applyHidden(true);
            masterPanel.style.display = 'none';
            saveHidden(true);
        });
        resetButton.addEventListener('click', () => {
            resetPanelLayout();
        });
        openConsoleButton.addEventListener('click', event => {
            event.stopPropagation();
            applyHidden(false);
            masterPanel.style.display = toolsOpen ? 'block' : 'none';
            saveHidden(false);
        });
        masterInput.addEventListener('change', () => toggleMasterMode().catch(error => {
            status.textContent = error.message;
            renderMasterState();
        }));
        compactMasterInput.addEventListener('change', () => toggleMasterMode().catch(error => {
            status.textContent = error.message;
            renderMasterState();
        }));
        header.addEventListener('pointerdown', startPanelDrag);
        window.addEventListener('resize', () => {
            if (body.style.display !== 'none') {
                keepPanelInViewport();
                schedulePanelLayoutSave();
            }
        });
        new ResizeObserver(schedulePanelLayoutSave).observe(panel);
        window.addEventListener(TOOLS_VISIBILITY_EVENT, event => {
            applyToolsVisibility(Boolean(event.detail?.open));
        });
        renderEnvironmentSwitch();
        renderMasterState();
    }

    function ensureSpinnerStyle() {
        if (document.getElementById('vb-bricksync-spinner-style')) return;

        const style = document.createElement('style');
        style.id = 'vb-bricksync-spinner-style';
        style.textContent = [
            '@keyframes vbBrickSyncSpinOff { to { transform: translateX(0) rotate(360deg); } }',
            '@keyframes vbBrickSyncSpinOn { to { transform: translateX(20px) rotate(360deg); } }'
        ].join('\n');
        document.head.appendChild(style);
    }

    function parseBrickLinkMasterState(text) {
        const stripped = stripAnsi(text);
        const lastCommandIndex = stripped.lastIndexOf('COMMAND:');
        const latestOutput = lastCommandIndex === -1 ? stripped : stripped.slice(lastCommandIndex);
        const lines = latestOutput.split(/\r?\n/).reverse();
        for (const line of lines) {
            if (!/BrickLink Master Mode/i.test(line) && !/\bblmaster\b/i.test(line)) {
                continue;
            }
            if (/BrickLink Master Mode.*currently\s+enabled/i.test(line) || /\benabled\b/i.test(line)) {
                return 'on';
            }
            if (/BrickLink Master Mode.*currently\s+disabled/i.test(line) || /\bdisabled\b/i.test(line)) {
                return 'off';
            }
        }
        return 'unknown';
    }

    function stripAnsi(text) {
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }

    function renderAnsiLogs(target, text) {
        target.textContent = '';
        let state = {};
        let index = 0;
        const regex = /\x1b\[([0-9;]*)m/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            appendLogText(target, text.slice(index, match.index), state);
            state = nextAnsiState(state, match[1]);
            index = regex.lastIndex;
        }
        appendLogText(target, text.slice(index), state);
    }

    function appendLogText(target, text, state) {
        if (!text) return;
        const span = document.createElement('span');
        span.textContent = text;
        if (state.color) span.style.color = state.color;
        if (state.background) span.style.backgroundColor = state.background;
        if (state.bold) span.style.fontWeight = '700';
        target.appendChild(span);
    }

    function nextAnsiState(current, rawCodes) {
        const codes = rawCodes ? rawCodes.split(';').map(code => Number(code || 0)) : [0];
        const next = { ...current };
        for (const code of codes) {
            if (code === 0) {
                Object.keys(next).forEach(key => delete next[key]);
            } else if (code === 1) {
                next.bold = true;
            } else if (code === 22) {
                delete next.bold;
            } else if (code === 39) {
                delete next.color;
            } else if (code === 49) {
                delete next.background;
            } else if (ansiColor(code)) {
                next.color = ansiColor(code);
            } else if (ansiBackground(code)) {
                next.background = ansiBackground(code);
            }
        }
        return next;
    }

    function ansiColor(code) {
        return {
            30: '#111827',
            31: '#f87171',
            32: '#34d399',
            33: '#fbbf24',
            34: '#60a5fa',
            35: '#c084fc',
            36: '#22d3ee',
            37: '#e5e7eb',
            90: '#6b7280',
            91: '#fca5a5',
            92: '#86efac',
            93: '#fde68a',
            94: '#93c5fd',
            95: '#d8b4fe',
            96: '#67e8f9',
            97: '#ffffff'
        }[code];
    }

    function ansiBackground(code) {
        return {
            40: '#030712',
            41: '#7f1d1d',
            42: '#064e3b',
            43: '#78350f',
            44: '#1e3a8a',
            45: '#581c87',
            46: '#164e63',
            47: '#f3f4f6'
        }[code];
    }

    function input(placeholder, value) {
        const element = document.createElement('input');
        element.placeholder = placeholder;
        element.value = value;
        Object.assign(element.style, {
            boxSizing: 'border-box',
            width: '100%',
            minWidth: '0',
            padding: '6px 8px',
            border: '1px solid #4b5563',
            borderRadius: '4px',
            background: '#1f2937',
            color: '#f9fafb',
            font: '12px Arial, sans-serif'
        });
        return element;
    }

    function buttonStyle() {
        return {
            padding: '6px 8px',
            border: '1px solid #4b5563',
            borderRadius: '4px',
            background: '#374151',
            color: '#f9fafb',
            cursor: 'pointer',
            font: '12px Arial, sans-serif'
        };
    }

    function iconButtonStyle() {
        return {
            ...buttonStyle(),
            width: '28px',
            height: '28px',
            padding: '0',
            font: '18px Arial, sans-serif',
            lineHeight: '26px'
        };
    }

    function tinyIconButtonStyle() {
        return {
            ...buttonStyle(),
            position: 'absolute',
            left: '6px',
            top: '5px',
            width: '14px',
            height: '14px',
            padding: '0',
            borderRadius: '2px',
            font: '7px Menlo, Consolas, monospace',
            lineHeight: '12px',
            zIndex: '1'
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureBrickSyncConsole);
    } else {
        ensureBrickSyncConsole();
    }
})();
