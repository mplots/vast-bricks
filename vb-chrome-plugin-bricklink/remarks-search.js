const VB_TOOLS_OPEN_KEY = 'vbBrickLinkToolsOpen';
const VB_SEARCH_OPEN_KEY = 'vbBrickLinkSearchOpen';
const VB_TOOLS_VISIBILITY_EVENT = 'vb-bricklink-tools-visibility-change';

function buildInventorySearchUrl(query) {
    const url = new URL('https://www.bricklink.com/v2/inventory_detail.page');
    url.searchParams.set('invSearch', 'R');
    url.searchParams.set('rmkTp', 'W');
    url.searchParams.set('catType', '');
    url.searchParams.set('bindType', '');
    url.searchParams.set('invNew', '');
    url.searchParams.set('invID', '');
    url.searchParams.set('bindID', '');
    url.searchParams.set('q', query);
    url.searchParams.set('viewSale', '');
    url.searchParams.set('invComplete', '');
    url.searchParams.set('setNo', '');
    url.searchParams.set('setSeq', '1');
    url.searchParams.set('breakType', 'M');
    url.searchParams.set('invDays', '');
    url.searchParams.set('invDaysType', 'O');
    url.searchParams.set('invSoldDays', '');
    url.searchParams.set('invSoldDaysType', 'O');
    url.searchParams.set('qMin', '');
    url.searchParams.set('qMax', '');
    url.searchParams.set('pMin', '');
    url.searchParams.set('pMax', '');
    url.searchParams.set('bMin', '');
    url.searchParams.set('bMax', '');
    url.hash = '/';
    return url.toString();
}

function getToolsOpen() {
    return new Promise(resolve => {
        chrome.storage.local.get([VB_TOOLS_OPEN_KEY], stored => {
            resolve(Boolean(stored[VB_TOOLS_OPEN_KEY]));
        });
    });
}

function setToolsOpen(open) {
    return new Promise(resolve => chrome.storage.local.set({ [VB_TOOLS_OPEN_KEY]: open }, resolve));
}

function getSearchOpen() {
    return new Promise(resolve => {
        chrome.storage.local.get([VB_SEARCH_OPEN_KEY], stored => {
            resolve(Boolean(stored[VB_SEARCH_OPEN_KEY]));
        });
    });
}

function setSearchOpen(open) {
    return new Promise(resolve => chrome.storage.local.set({ [VB_SEARCH_OPEN_KEY]: open }, resolve));
}

function broadcastToolsVisibility(open) {
    document.documentElement.dataset.vbBrickLinkToolsOpen = open ? 'true' : 'false';
    window.dispatchEvent(new CustomEvent(VB_TOOLS_VISIBILITY_EVENT, { detail: { open } }));
}

function getIconSvg(iconName) {
    if (iconName === 'search') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4.2-4.2"></path></svg>';
    }

    return '<svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.3a2 2 0 1 1-4 0V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.7a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.3a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.3a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg>';
}

function createFloatingButton(id, title, iconName, bottom) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = getIconSvg(iconName);
    button.style.position = 'fixed';
    button.style.right = '14px';
    button.style.bottom = bottom;
    button.style.zIndex = '2147483647';
    button.style.width = '44px';
    button.style.height = '44px';
    button.style.border = '1px solid #0f766e';
    button.style.borderRadius = '50%';
    button.style.background = '#047857';
    button.style.color = '#ffffff';
    button.style.boxShadow = '0 6px 18px rgba(0,0,0,0.28)';
    button.style.cursor = 'pointer';
    button.style.lineHeight = '1';
    button.style.display = 'grid';
    button.style.placeItems = 'center';
    button.style.padding = '0';
    return button;
}

function createSearchPanel() {
    const wrapper = document.createElement('div');
    wrapper.id = 'vb-bricklink-search-panel';
    wrapper.style.position = 'fixed';
    wrapper.style.right = '66px';
    wrapper.style.bottom = '66px';
    wrapper.style.zIndex = '2147483647';
    wrapper.style.width = '236px';
    wrapper.style.padding = '10px';
    wrapper.style.background = '#ffffff';
    wrapper.style.border = '1px solid #a8a8a8';
    wrapper.style.borderRadius = '4px';
    wrapper.style.boxShadow = '0 4px 14px rgba(0,0,0,0.22)';
    wrapper.style.fontFamily = 'Arial, sans-serif';

    const title = document.createElement('div');
    title.textContent = 'Inventory Search';
    title.style.font = '700 12px Arial, sans-serif';
    title.style.marginBottom = '8px';
    title.style.color = '#111827';

    const label = document.createElement('label');
    label.textContent = 'By remarks';
    label.htmlFor = 'vb-bricklink-search-remarks';
    label.style.display = 'block';
    label.style.font = '12px Arial, sans-serif';
    label.style.marginBottom = '4px';
    label.style.color = '#374151';

    const input = document.createElement('input');
    input.id = 'vb-bricklink-search-remarks';
    input.type = 'text';
    input.placeholder = 'Search remarks';
    input.autocomplete = 'off';
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.padding = '6px 8px';
    input.style.border = '1px solid #8d8d8d';
    input.style.borderRadius = '3px';
    input.style.font = '12px Arial, sans-serif';

    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;

        event.preventDefault();
        event.stopPropagation();

        const query = input.value.trim();
        if (!query) return;

        window.location.href = buildInventorySearchUrl(query);
        input.value = '';
    });

    const apiConsumerLink = document.createElement('a');
    apiConsumerLink.href = 'https://www.bricklink.com/v2/api/register_consumer.page';
    apiConsumerLink.textContent = 'API Consumer';
    apiConsumerLink.style.display = 'inline-block';
    apiConsumerLink.style.marginTop = '8px';
    apiConsumerLink.style.font = '11px Arial, sans-serif';
    apiConsumerLink.style.color = '#6b21a8';
    apiConsumerLink.style.textDecoration = 'none';

    apiConsumerLink.addEventListener('mouseover', () => {
        apiConsumerLink.style.textDecoration = 'underline';
    });
    apiConsumerLink.addEventListener('mouseout', () => {
        apiConsumerLink.style.textDecoration = 'none';
    });

    const brickStoreAccessLink = document.createElement('a');
    brickStoreAccessLink.href = 'https://www.bricklink.com/v3/brickstore-access-management.page';
    brickStoreAccessLink.textContent = 'BrickStore Access Management';
    brickStoreAccessLink.style.display = 'block';
    brickStoreAccessLink.style.marginTop = '4px';
    brickStoreAccessLink.style.font = '11px Arial, sans-serif';
    brickStoreAccessLink.style.color = '#6b21a8';
    brickStoreAccessLink.style.textDecoration = 'none';

    brickStoreAccessLink.addEventListener('mouseover', () => {
        brickStoreAccessLink.style.textDecoration = 'underline';
    });
    brickStoreAccessLink.addEventListener('mouseout', () => {
        brickStoreAccessLink.style.textDecoration = 'none';
    });

    wrapper.append(title, label, input, apiConsumerLink, brickStoreAccessLink);
    return wrapper;
}

async function ensureInventorySearchWidget() {
    if (document.getElementById('vb-bricklink-tools-launcher')) return;

    const launcher = createFloatingButton('vb-bricklink-tools-launcher', 'Vast Bricks tools', 'settings', '14px');
    const searchLauncher = createFloatingButton('vb-bricklink-search-launcher', 'Inventory search', 'search', '66px');
    const searchPanel = createSearchPanel();

    document.body.append(launcher, searchLauncher, searchPanel);

    let toolsOpen = await getToolsOpen();
    let searchOpen = await getSearchOpen();
    applyToolsVisibility(toolsOpen);
    applySearchVisibility(searchOpen);

    launcher.addEventListener('click', () => {
        toolsOpen = !toolsOpen;
        applyToolsVisibility(toolsOpen);
        setToolsOpen(toolsOpen);
    });

    searchLauncher.addEventListener('click', () => {
        searchOpen = !searchOpen;
        applySearchVisibility(searchOpen);
        setSearchOpen(searchOpen);
    });

    function applyToolsVisibility(open) {
        launcher.style.background = open ? '#064e3b' : '#047857';
        launcher.style.borderColor = open ? '#10b981' : '#0f766e';
        broadcastToolsVisibility(open);
    }

    function applySearchVisibility(open) {
        searchPanel.style.display = open ? 'block' : 'none';
        searchLauncher.style.background = open ? '#064e3b' : '#047857';
        searchLauncher.style.borderColor = open ? '#10b981' : '#0f766e';
        if (open) {
            searchPanel.querySelector('input')?.focus();
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureInventorySearchWidget);
} else {
    ensureInventorySearchWidget();
}
