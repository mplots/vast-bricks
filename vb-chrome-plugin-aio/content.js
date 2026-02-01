function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const RUN_INTERVAL_MS = 4 * 60 * 60 * 1000;
const LAST_RUN_KEY = 'vb_last_run_aio';

function getLastRun() {
    const value = Number(localStorage.getItem(LAST_RUN_KEY));
    return Number.isFinite(value) ? value : 0;
}

function setLastRun() {
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
}

async function post(url) {
    //Sleep for two seconds for page to load.
    await sleep(2000)

    while (true) {
        try {
            let resp = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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
        console.log('waiting 10 seconds before retying')
        await sleep(10000)
    }
}

(async () => {
    const lastRun = getLastRun();
    const now = Date.now();
    const nextRunIn = RUN_INTERVAL_MS - (now - lastRun);
    if (lastRun && nextRunIn > 0) {
        console.log(`skipping run, next in ${Math.ceil(nextRunIn / 60000)} minutes`);
        await sleep(nextRunIn);
        window.location.href = window.location.origin + window.location.pathname + "?manufacturer-id=1022&category-id=331";
        return;
    }

    const numberOfPages = document.querySelector('a.last')?.textContent.trim();
    for(let i=1; i<=numberOfPages; i++ ) {
        [...document.querySelectorAll('div.pages a')]
            .find(a => a.textContent.trim() === String(i))
            ?.click();

        console.log(`posting page ${i}`)
        await post('https://tool.vastbricks.com/api/aio')
    }

    setLastRun();
    console.log("sleeping for 4 hours")
    await sleep(4 * 60 * 60 * 1000)
    window.location.href = window.location.origin + window.location.pathname + "?manufacturer-id=1022&category-id=331";
})();
