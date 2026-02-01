function getBuyerInfoTable() {
    const contactLink = Array.from(document.querySelectorAll('a'))
        .find(a => a.href.includes('/contact.asp?orderID='));

    if (!contactLink) return;

    const baseTable = contactLink.closest('table');
    if (!baseTable) return;

    let buyerInfoTable = baseTable.nextElementSibling;
    while (buyerInfoTable && buyerInfoTable.tagName !== 'TABLE') {
        buyerInfoTable = buyerInfoTable.nextElementSibling;
    }
    return buyerInfoTable;
}

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

function buildQridLinks(qrids) {
    return qrids.map(qrid => `https://vastbricks.com?qrid=${qrid}`).join('\n');
}

(function () {
    const buyerInfoTable = getBuyerInfoTable();
    if (!buyerInfoTable) return;

    // const newRow = document.createElement('tr');
    // newRow.bgColor = '#EEEEEE';
    // newRow.innerHTML = `
    //   <td style="vertical-align: top;"><label for="qrTextArea">&nbsp;QR IDs:</label></td>
    //   <td>
    //     <textarea id="qrTextArea" rows="4" style="width: 350px;"></textarea>
    //     <div style="margin-top: 6px;">
    //       <button id="submitQrBtn">Submit</button>
    //       <span id="statusMsg" style="margin-left: 10px; font-weight: bold;"></span>
    //     </div>
    //   </td>
    // `;
    // buyerInfoTable.querySelector('tbody').appendChild(newRow);

    const weightRow = document.createElement('tr');
    weightRow.bgColor = '#EEEEEE';
    weightRow.innerHTML = `
      <td><label for="weightInput">&nbsp;Weight (g):</label></td>
      <td>
        <input id="weightInput" type="number" style="width: 120px;" />
        <button id="openManspastsBtn">Generate Shipping Label</button>
        <span id="manspastsStatus" style="margin-left: 10px; font-weight: bold;"></span>
      </td>
    `;
    buyerInfoTable.querySelector('tbody').appendChild(weightRow);

    const priceRow = document.createElement('tr');
    priceRow.bgColor = '#EEEEEE';
    priceRow.style.display = 'none';
    priceRow.innerHTML = `
      <td><label>&nbsp;Price:</label></td>
      <td><span id="shippingPriceCell"></span></td>
    `;
    buyerInfoTable.querySelector('tbody').appendChild(priceRow);

    const deliveryRow = document.createElement('tr');
    deliveryRow.bgColor = '#EEEEEE';
    deliveryRow.style.display = 'none';
    deliveryRow.innerHTML = `
      <td><label>&nbsp;Delivery:</label></td>
      <td><span id="deliveryDaysCell"></span></td>
    `;
    buyerInfoTable.querySelector('tbody').appendChild(deliveryRow);

    // const btn = document.getElementById('submitQrBtn');
    // const statusMsg = document.getElementById('statusMsg');
    // const textArea = document.getElementById('qrTextArea');
    const orderId = new URL(window.location.href).searchParams.get('ID');
    const manspastsBtn = document.getElementById('openManspastsBtn');
    const manspastsStatus = document.getElementById('manspastsStatus');

    // if (orderId) {
    //     fetch(`https://tool.vastbricks.com/api/qr/list?orderId=${encodeURIComponent(orderId)}&source=BRICKLINK`)
    //         .then(res => res.ok ? res.json() : Promise.reject(res))
    //         .then(data => {
    //             if (Array.isArray(data?.qrids) && data.qrids.length) {
    //                 textArea.value = buildQridLinks(data.qrids);
    //             }
    //         })
    //         .catch(err => console.error('Failed to load QR IDs', err));
    // }
    //
    // btn.addEventListener('click', () => {
    //     const orderId = new URL(window.location.href).searchParams.get('ID');
    //     const qrids = extractQrids(textArea.value);
    //
    //     if (!orderId) {
    //         statusMsg.style.color = 'red';
    //         statusMsg.textContent = 'Order ID not found in URL.';
    //         return;
    //     }
    //
    //     if (!qrids.length) {
    //         statusMsg.style.color = 'red';
    //         statusMsg.textContent = 'No valid QR IDs found.';
    //         return;
    //     }
    //
    //     const payload = { orderId: orderId, source: 'BRICKLINK', qrids: qrids };
    //
    //     statusMsg.style.color = 'blue';
    //     statusMsg.textContent = 'Submitting...';
    //     btn.disabled = true;
    //
    //     fetch('https://tool.vastbricks.com/api/qr/register', {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify(payload)
    //     })
    //     .then(res => {
    //         if (!res.ok) {
    //             throw new Error(`HTTP error! status: ${res.status}`);
    //         }
    //         return res.json();
    //     })
    //     .then(data => {
    //         const registered = data?.registeredQrids?.length ?? qrids.length;
    //         const existing = data?.existingQrids?.length ?? 0;
    //         statusMsg.style.color = 'green';
    //         statusMsg.textContent = `Registered: ${registered}, existing: ${existing}.`;
    //     })
    //     .catch(err => {
    //         console.error(err);
    //         statusMsg.style.color = 'red';
    //         statusMsg.textContent = 'Submission failed!';
    //     })
    //     .finally(() => {
    //         btn.disabled = false;
    //     });
    // });

    let lastMetaText = '';
    const shippingPriceCell = document.getElementById('shippingPriceCell');
    const deliveryDaysCell = document.getElementById('deliveryDaysCell');

    manspastsBtn.addEventListener('click', () => {
        const orderId = new URL(window.location.href).searchParams.get('ID');
        const weight = document.getElementById('weightInput').value;

        if (!orderId) {
            manspastsStatus.style.color = 'red';
            manspastsStatus.textContent = 'Order ID not found.';
            return;
        }
        if (!weight) {
            manspastsStatus.style.color = 'red';
            manspastsStatus.textContent = 'Enter weight.';
            return;
        }

        manspastsStatus.style.color = 'blue';
        manspastsStatus.textContent = 'Preparing PDF...';
        manspastsBtn.disabled = true;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000);

        fetch('https://tool.vastbricks.com/api/bricklink/shipping-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: Number(orderId), weight: Number(weight) }),
            signal: controller.signal
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const shippingPrice = res.headers.get('X-Shipping-Price');
            const deliveryDays = res.headers.get('X-Delivery-Days');
            if (shippingPrice || deliveryDays) {
                if (shippingPriceCell) {
                    shippingPriceCell.textContent = shippingPrice || '-';
                }
                if (deliveryDaysCell) {
                    deliveryDaysCell.textContent = deliveryDays || '-';
                }
                priceRow.style.display = '';
                deliveryRow.style.display = '';
                manspastsStatus.style.color = 'blue';
                manspastsStatus.textContent = 'Preparing PDF...';
            }
            return res.arrayBuffer();
        })
        .then(buffer => {
            const blob = new Blob([buffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `manspasts_${orderId}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            manspastsStatus.style.color = 'green';
            manspastsStatus.textContent = 'Done.';
        })
        .catch(err => {
            console.error(err);
            manspastsStatus.style.color = 'red';
            manspastsStatus.textContent = err.name === 'AbortError'
                ? 'Timed out while preparing PDF.'
                : 'Failed to prepare PDF.';
        })
        .finally(() => {
            clearTimeout(timeoutId);
            manspastsBtn.disabled = false;
        });
    });
})();
