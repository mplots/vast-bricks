function getBuyerInfoTable() {
    // 1. Find the anchor with contact link (ignoring specific ID)
    const contactLink = Array.from(document.querySelectorAll('a'))
        .find(a => a.href.includes('/contact.asp?orderID='));

    if (!contactLink) return;

    // 2. Get the parent <table> that contains this <a>
    const baseTable = contactLink.closest('table');
    if (!baseTable) return;

    // 3. The buyer info table is the *next* sibling table
    let buyerInfoTable = baseTable.nextElementSibling;
    while (buyerInfoTable && buyerInfoTable.tagName !== 'TABLE') {
        buyerInfoTable = buyerInfoTable.nextElementSibling;
    }
    return buyerInfoTable;
}

(function () {
    const buyerInfoTable = getBuyerInfoTable();
    if (!buyerInfoTable) return;

    const newRow = document.createElement('tr');
    newRow.bgColor = '#EEEEEE';
    newRow.innerHTML = `
      <td><label for="weightInput">&nbsp;Weight (g):</label></td>
      <td>
        <input id="weightInput" type="number" style="width: 100px;" />
        <button id="submitWeightBtn">Submit</button>
        <span id="statusMsg" style="margin-left: 10px; font-weight: bold;"></span>
      </td>
    `;
    buyerInfoTable.querySelector('tbody').appendChild(newRow);

    const btn = document.getElementById('submitWeightBtn');
    const statusMsg = document.getElementById('statusMsg');

    btn.addEventListener('click', () => {
        const weight = document.getElementById('weightInput').value;
        const id = new URL(window.location.href).searchParams.get("ID");
        const payload = { orderId: id, weight: weight };

        // Show loading indicator
        statusMsg.style.color = "blue";
        statusMsg.textContent = "Submitting...";

        fetch('https://vastbricks.com/api/bricklink/shipping-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.blob();
        })
        .then(blob => {
            // Create a download link for PDF
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `shipping-label-${id}.pdf`; // file name
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            statusMsg.style.color = "green";
            statusMsg.textContent = `PDF downloaded successfully!`;
        })
        .catch(err => {
            console.error(err);
            statusMsg.style.color = "red";
            statusMsg.textContent = "Submission failed!";
        });
    });
})();
