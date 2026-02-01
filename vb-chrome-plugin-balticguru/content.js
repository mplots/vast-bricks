function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const RUN_INTERVAL_MS = 4 * 60 * 60 * 1000;
const LAST_RUN_KEY = 'vb_last_run_balticguru';

function getLastRun() {
    const value = Number(localStorage.getItem(LAST_RUN_KEY));
    return Number.isFinite(value) ? value : 0;
}

function setLastRun() {
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
}

function getPageFromUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        const value = parsed.searchParams.get('page');
        const page = value ? parseInt(value, 10) : NaN;
        return Number.isFinite(page) ? page : null;
    } catch (err) {
        return null;
    }
}

function getCurrentPage() {
    const page = getPageFromUrl(window.location.href);
    return page ?? 1;
}

function getMaxPage() {
    const links = Array.from(document.querySelectorAll('a[href*="page="]'));
    const pages = links
        .map(link => getPageFromUrl(link.getAttribute('href')))
        .filter(page => Number.isFinite(page));
    if (!pages.length) {
        return getCurrentPage();
    }
    return Math.max(...pages);
}

function buildPageUrl(page) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '100');
    return url.toString();
}

async function post(url) {
    await sleep(2000);

    while (true) {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: document.documentElement.outerHTML
                })
            });
            if (resp.ok) {
                break;
            } else {
                console.warn(`server responded with status ${resp.status}`);
            }
        } catch (e) {
            console.error('page post failed:', e);
        }
        console.log('waiting 10 seconds before retrying');
        await sleep(10000);
    }
}

(async () => {
    const lastRun = getLastRun();
    const now = Date.now();
    const nextRunIn = RUN_INTERVAL_MS - (now - lastRun);
    if (lastRun && nextRunIn > 0 && getCurrentPage() === 1) {
        console.log(`skipping run, next in ${Math.ceil(nextRunIn / 60000)} minutes`);
        await sleep(nextRunIn);
        window.location.href = buildPageUrl(1);
        return;
    }

    const currentPage = getCurrentPage();
    const maxPage = getMaxPage();

    console.log(`posting page ${currentPage} of ${maxPage}`);
    await post('https://tool.vastbricks.com/api/balticguru');

    if (currentPage < maxPage) {
        window.location.href = buildPageUrl(currentPage + 1);
        return;
    }

    setLastRun();
    console.log('sleeping for 4 hours');
    await sleep(4 * 60 * 60 * 1000);
    window.location.href = buildPageUrl(1);
})();
