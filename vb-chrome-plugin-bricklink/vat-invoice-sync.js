(function () {
    /**
     * Sends the platform the VAT invoices it is missing, from whatever BrickLink page the store happens to be on.
     *
     * <p>BrickLink issues an invoice for the orders it collected the VAT on itself and serves it only to the
     * signed-in store, so the platform cannot always fetch one itself - the extension is here because the browser's
     * own session is the one BrickLink is certain to still accept. This asks which orders are missing an invoice on
     * page load, downloads each one with that session, and hands it over.
     *
     * <p>Every page rather than the order pages, because an invoice is missing whether or not anybody visits the
     * order it belongs to: opening BrickLink at all is the occasion to catch up. Asking is one small call to the
     * platform's own database, so it is asked on every page open rather than on a timer - a store that owes nothing
     * is the normal answer, and it costs that one call and stops there.
     *
     * <p>What is rationed is the downloading, not the asking. A run collects at most a few invoices, so a store
     * catching up a year of orders does it over several page views instead of hammering BrickLink once, and it takes
     * a short lease first so that opening several tabs does not set them all downloading the same invoices. The
     * lease is brief and expires on its own, because the alternative - a tab that closed mid-run holding it - is a
     * store whose invoices silently stop being collected.
     *
     * <p>The platform is reached through the background worker, which holds the API key and is not subject to this
     * page's CORS. BrickLink is reached from here, because it is the page's own session that may read an invoice.
     */

    /** Held while a tab is downloading invoices, so two of them do not download the same ones. */
    const COLLECTING_KEY = 'vbVatInvoiceCollecting';
    const COLLECT_LEASE_MS = 2 * 60 * 1000;
    /** Asked for by the console's own button, which collects now whatever lease another tab is holding. */
    const COLLECT_EVENT = 'vb-vat-invoice-collect';
    const COLLECTED_EVENT = 'vb-vat-invoice-collected';
    const MAX_INVOICES_PER_RUN = 5;
    /**
     * Where BrickLink serves the invoice it issued for an order. The whole URL is the order id and the kind: there
     * is no file id to look up, which is why this goes straight for the PDF rather than reading the order's page to
     * find a link to it. The backend's own BrickStore client addresses it exactly the same way.
     */
    const VAT_INVOICE_URL = 'https://www.bricklink.com/_file/orders/vat_invoice.file?type=I&oid=';
    /** How far into a download to look for the marker, as the backend's client looks. */
    const PDF_SEARCH_LENGTH = 1024;

    function storageGet(keys) {
        return new Promise(resolve => chrome.storage.local.get(keys, resolve));
    }

    function storageSet(values) {
        return new Promise(resolve => chrome.storage.local.set(values, resolve));
    }

    function sendMessage(message) {
        return new Promise(resolve => {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, status: 0, statusText: chrome.runtime.lastError.message, body: {} });
                    return;
                }
                resolve(response || { ok: false, status: 0, statusText: 'No response from Vast Bricks', body: {} });
            });
        });
    }

    /**
     * Takes the downloading lease, or says another tab is holding it.
     *
     * <p>Two tabs reading and writing at the same instant can both take it, since extension storage offers nothing
     * to compare and swap on. That costs a duplicate download and nothing else: the second invoice to arrive is the
     * one the archive already holds, which the platform answers with {@code stored: false} rather than a rewrite.
     */
    async function takeCollectingLease() {
        const stored = await storageGet(COLLECTING_KEY);
        const held = Number(stored[COLLECTING_KEY] || 0);
        if (Number.isFinite(held) && held > 0 && Date.now() - held < COLLECT_LEASE_MS) {
            console.debug('Vast Bricks: another tab is collecting VAT invoices');
            return false;
        }
        await storageSet({ [COLLECTING_KEY]: Date.now() });
        return true;
    }

    function releaseCollectingLease() {
        return storageSet({ [COLLECTING_KEY]: 0 });
    }

    /**
     * The invoice BrickLink holds for one order, downloaded with the store's own session, or null where it has none
     * to serve.
     *
     * <p>What comes back is checked for being a PDF rather than taken on the status alone, for the reason the
     * backend's client checks it: an order BrickLink issued no invoice for, and a session it no longer accepts, are
     * both answered with a page and a status that says nothing was wrong.
     */
    async function downloadVatInvoice(orderId) {
        const invoice = await fetch(`${VAT_INVOICE_URL}${encodeURIComponent(orderId)}`, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/pdf' }
        });
        if (!invoice.ok) {
            throw new Error(`BrickLink would not serve the invoice of order ${orderId}: ${invoice.status} ${invoice.statusText}`);
        }

        const downloaded = await invoice.arrayBuffer();
        return isPdf(downloaded) ? base64Of(downloaded) : null;
    }

    function isPdf(buffer) {
        const text = new TextDecoder('latin1').decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, PDF_SEARCH_LENGTH)));
        return text.includes('%PDF');
    }

    /** A message carries no bytes, so the PDF travels as base64. Chunked, because a whole invoice at once overflows
     * the argument list of String.fromCharCode. */
    function base64Of(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let index = 0; index < bytes.length; index += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        }
        return btoa(binary);
    }

    /**
     * Says how a run ended, in the console and to whoever asked for it by button.
     *
     * <p>The ordinary answer - nothing is missing - is a debug line rather than an info one, because it is the
     * answer on every page a store opens and would otherwise be the loudest thing in its console.
     */
    function report(summary, ordinary) {
        console[ordinary ? 'debug' : 'info'](`Vast Bricks: ${summary}`);
        document.dispatchEvent(new CustomEvent(COLLECTED_EVENT, { detail: { summary } }));
        return summary;
    }

    async function collect(force) {
        const outstanding = await sendMessage({ type: 'vb-vat-invoices-outstanding' });
        if (outstanding.unconfigured) {
            // No key pasted into the settings yet, which is a store that has not set this up rather than a failure.
            report('no Vast API key configured, so VAT invoices are not being collected', !force);
            return;
        }
        if (!outstanding.ok) {
            console.warn('Vast Bricks: could not ask which VAT invoices are missing', outstanding.statusText, outstanding.body);
            report(`could not reach the platform: ${outstanding.statusText}`);
            return;
        }

        const orders = (outstanding.body && outstanding.body.orders) || [];
        if (orders.length === 0) {
            report('no VAT invoices are missing', !force);
            return;
        }

        // Only now, with something to download, is a lease worth taking: the asking above is cheap and every page
        // open is welcome to do it.
        if (!force && !(await takeCollectingLease())) {
            return;
        }

        const collecting = orders.slice(0, MAX_INVOICES_PER_RUN);
        report(`${orders.length} order(s) missing a VAT invoice, collecting ${collecting.length}`);
        let archived = 0;
        try {
            for (const order of collecting) {
                try {
                    const pdf = await downloadVatInvoice(order.orderId);
                    if (!pdf) {
                        // Nothing to hand over: either no invoice was issued after all, or this session is not the
                        // store's. The platform keeps asking until one arrives, which is what makes that safe.
                        console.info(`Vast Bricks: BrickLink served no VAT invoice for order ${order.orderId}`);
                        continue;
                    }
                    const stored = await sendMessage({ type: 'vb-vat-invoice-store', orderId: order.orderId, pdf });
                    if (!stored.ok) {
                        console.warn(`Vast Bricks: could not hand over the VAT invoice of order ${order.orderId}`,
                            stored.statusText, stored.body);
                        continue;
                    }
                    archived++;
                    console.info(`Vast Bricks: VAT invoice of order ${order.orderId} ${stored.body.stored ? 'archived' : 'was already archived'}`);
                } catch (error) {
                    console.warn(`Vast Bricks: ${error.message}`);
                }
            }
        } finally {
            await releaseCollectingLease();
        }
        report(`collected ${archived} of ${collecting.length} VAT invoice(s)`);
    }

    let running = false;

    /** One run at a time in this tab, however it was asked for. */
    function run(force) {
        if (running) {
            return Promise.resolve();
        }
        running = true;
        return collect(force)
            .catch(error => console.warn('Vast Bricks: VAT invoice collection failed', error))
            .finally(() => running = false);
    }

    // Collect now, lease or no lease: somebody pressed the button and is watching.
    document.addEventListener(COLLECT_EVENT, () => run(true));

    // And on every BrickLink page, which is the whole point: a store that owes an invoice sends it by opening the
    // site, without being asked and without waiting for a nightly anything.
    run(false);
})();
