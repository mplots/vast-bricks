const typeLikeHuman = async (el, text, delay = 100) => {
    el.value = '';
    for (const ch of text) {
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, delay + Math.random() * 100));
    }
};

const simulateMouseMovement = (el, steps = 20, delay = 50) => {
    const rect = el.getBoundingClientRect();
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;

    let i = 0;
    const move = () => {
        if (i > steps) return;
        const x = startX + ((endX - startX) * i) / steps;
        const y = startY + ((endY - startY) * i) / steps;
        const evt = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
        });
        document.dispatchEvent(evt);
        i++;
        setTimeout(move, delay + Math.random() * 20);
    };
    move();
};

// Random delay generator: sum of all delays ≤ maxTotalMs
const generateDelays = (count, minMs, maxMs, maxTotalMs) => {
    const delays = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
        const remaining = count - i;
        const maxDelay = Math.min(maxMs, (maxTotalMs - total - (remaining - 1) * minMs));
        const minDelay = minMs;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        delays.push(delay);
        total += delay;
    }
    return delays;
};

(async () => {
    const offers = await fetch('http://localhost:6161/api/offers').then(r => r.json());
    const index = +localStorage.getItem('lego_crawl_index') || 0;

    const remaining = offers.length - index;
    const delays = generateDelays(remaining, 8000, 15000, 24 * 60 * 60 * 1000); // max 3 hours

    const current = offers[index];
    if (!current) {
        localStorage.removeItem('lego_crawl_index');
        console.log('✅ All done!');
        return;
    }

    const delay = delays[0];
    console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before searching "${current.setNumber}"`);
    await new Promise(r => setTimeout(r, delay));
    window.scrollTo(0, Math.random() * document.body.scrollHeight);

    if (index > 0) {
        await fetch('http://localhost:6161/api/salidzini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                setNumber: offers[index - 1].setNumber,
                html: document.documentElement.outerHTML
            })
        });
    }

    localStorage.setItem('lego_crawl_index', index + 1);
    simulateMouseMovement(document.querySelector('#q'));
    await typeLikeHuman(document.querySelector('#q'), `lego ${current.setNumber}`);
    document.querySelector('#search_form').submit();
})();
