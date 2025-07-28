function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    const numberOfPages = document.querySelector('a.pageSlot-7')?.textContent.trim();
    for(let i=1; i<=numberOfPages; i++ ) {
        [...document.querySelectorAll('span[rel-widget-id="pagination"] a')]
            .find(a => a.textContent.trim() === String(i))
            ?.click();

        console.log(`posting page ${i}`)
        await post('https://vastbricks.com/api/220')
    }

    console.log("sleeping for an hour")
    await sleep(60 * 60 * 1000)
    window.location.reload();
})();
