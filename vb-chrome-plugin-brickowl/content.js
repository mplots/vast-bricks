function extractQrids(rawText) {
    const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const qrids = [];
    const seen = new Set();

    for (const line of lines) {
        let qrid = null;
        try {
            const url = new URL(line);
            qrid = url.searchParams.get('qrid');
        } catch (err) {
            const match = line.match(/(?:^|[?&])qrid=([^&\s]+)/);
            if (match) {
                qrid = match[1];
            }
        }

        if (qrid && !seen.has(qrid)) {
            seen.add(qrid);
            qrids.push(qrid);
        }
    }

    return qrids;
}

function getOrderDetailsTableBody() {
    const blocks = Array.from(document.querySelectorAll('.order-block'));
    const block = blocks.find(el => {
        const title = el.querySelector('.order-block-title');
        return title && title.textContent.trim() === 'Order Details';
    });

    if (!block) return;

    const table = block.querySelector('table.form-list');
    if (!table) return;

    return table.querySelector('tbody');
}

function buildQridLinks(qrids) {
    return qrids.map(qrid => `https://vastbricks.com?qrid=${qrid}`).join('\n');
}

(function () {
    const tbody = getOrderDetailsTableBody();
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const lastRow = rows[rows.length - 1];
    let rowClass = 'odd';
    if (lastRow) {
        if (lastRow.classList.contains('odd')) {
            rowClass = 'even';
        } else if (lastRow.classList.contains('even')) {
            rowClass = 'odd';
        }
    }

    const newRow = document.createElement('tr');
    newRow.className = rowClass;
    newRow.innerHTML = `
      <td class="flabel">QR IDs</td>
      <td class="value">
        <textarea id="qrTextArea" rows="4" style="width: 350px;"></textarea>
        <div style="margin-top: 6px;">
          <button id="submitQrBtn">Submit</button>
          <span id="statusMsg" style="margin-left: 10px; font-weight: bold;"></span>
        </div>
      </td>
    `;
    tbody.appendChild(newRow);

    const btn = document.getElementById('submitQrBtn');
    const statusMsg = document.getElementById('statusMsg');
    const textArea = document.getElementById('qrTextArea');
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const orderId = pathParts[pathParts.length - 1];

    if (orderId) {
        fetch(`https://tool.vastbricks.com/api/qr/list?orderId=${encodeURIComponent(orderId)}&source=BRICK_OWL`)
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(data => {
                if (Array.isArray(data?.qrids) && data.qrids.length) {
                    textArea.value = buildQridLinks(data.qrids);
                }
            })
            .catch(err => console.error('Failed to load QR IDs', err));
    }

    btn.addEventListener('click', () => {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const orderId = pathParts[pathParts.length - 1];
        const qrids = extractQrids(textArea.value);

        if (!orderId) {
            statusMsg.style.color = 'red';
            statusMsg.textContent = 'Order ID not found in URL.';
            return;
        }

        if (!qrids.length) {
            statusMsg.style.color = 'red';
            statusMsg.textContent = 'No valid QR IDs found.';
            return;
        }

        const payload = { orderId: orderId, source: 'BRICK_OWL', qrids: qrids };

        statusMsg.style.color = 'blue';
        statusMsg.textContent = 'Submitting...';
        btn.disabled = true;

        fetch('https://tool.vastbricks.com/api/qr/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
        })
        .then(data => {
            const registered = data?.registeredQrids?.length ?? qrids.length;
            const existing = data?.existingQrids?.length ?? 0;
            statusMsg.style.color = 'green';
            statusMsg.textContent = `Registered: ${registered}, existing: ${existing}.`;
        })
        .catch(err => {
            console.error(err);
            statusMsg.style.color = 'red';
            statusMsg.textContent = 'Submission failed!';
        })
        .finally(() => {
            btn.disabled = false;
        });
    });
})();
