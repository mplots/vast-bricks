const VB_TOOLS_OPEN_KEY = 'vbBrickLinkToolsOpen';
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

function broadcastToolsVisibility(open) {
    document.documentElement.dataset.vbBrickLinkToolsOpen = open ? 'true' : 'false';
    window.dispatchEvent(new CustomEvent(VB_TOOLS_VISIBILITY_EVENT, { detail: { open } }));
}

async function ensureInventorySearchWidget() {
    if (document.getElementById('vb-bricklink-tools-inventory-search')) return;

    const launcher = document.createElement('button');
    launcher.id = 'vb-bricklink-tools-launcher';
    launcher.type = 'button';
    launcher.title = 'Vast Bricks tools';
    launcher.style.position = 'fixed';
    launcher.style.right = '14px';
    launcher.style.bottom = '14px';
    launcher.style.zIndex = '2147483647';
    launcher.style.width = '52px';
    launcher.style.height = '52px';
    launcher.style.border = '1px solid #374151';
    launcher.style.borderRadius = '50%';
    launcher.style.background = '#111827';
    launcher.style.color = '#f9fafb';
    launcher.style.boxShadow = '0 8px 24px rgba(0,0,0,0.32)';
    launcher.style.cursor = 'pointer';
    launcher.style.font = '34px Arial, sans-serif';
    launcher.style.lineHeight = '1';
    launcher.style.display = 'grid';
    launcher.style.placeItems = 'center';
    launcher.style.padding = '0';

    launcher.textContent = '⚙';

    const wrapper = document.createElement('div');
    wrapper.id = 'vb-bricklink-tools-inventory-search';
    wrapper.style.position = 'fixed';
    wrapper.style.right = '14px';
    wrapper.style.bottom = '74px';
    wrapper.style.zIndex = '2147483647';
    wrapper.style.padding = '8px';
    wrapper.style.background = '#ffffff';
    wrapper.style.border = '1px solid #a8a8a8';
    wrapper.style.borderRadius = '4px';
    wrapper.style.boxShadow = '0 4px 14px rgba(0,0,0,0.22)';
    wrapper.style.fontFamily = 'Arial, sans-serif';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Inventory search';
    input.autocomplete = 'off';
    input.style.width = '150px';
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

    wrapper.appendChild(input);
    document.body.appendChild(launcher);
    document.body.appendChild(wrapper);

    let toolsOpen = await getToolsOpen();
    applyToolsVisibility(toolsOpen);

    launcher.addEventListener('click', () => {
        toolsOpen = !toolsOpen;
        applyToolsVisibility(toolsOpen);
        setToolsOpen(toolsOpen);
    });

    function applyToolsVisibility(open) {
        wrapper.style.display = open ? 'block' : 'none';
        launcher.style.background = open ? '#064e3b' : '#111827';
        launcher.style.borderColor = open ? '#10b981' : '#374151';
        broadcastToolsVisibility(open);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureInventorySearchWidget);
} else {
    ensureInventorySearchWidget();
}
