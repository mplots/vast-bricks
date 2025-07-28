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

    const newRow = document.createElement('tr');
    newRow.bgColor = '#EEEEEE'
    newRow.innerHTML = `
    <td><label for="weightInput">&nbsp;Weight (g):</label></td>
    <td>
      <input id="weightInput" type="number" style="width: 100px;" />
      <button id="submitWeightBtn">Submit</button>
    </td>
  `;
    buyerInfoTable.querySelector('tbody').appendChild(newRow);

    // 5. Helper to extract text safely
    function getText(td) {
        return td ? td.textContent.trim() : '';
    }

    document.getElementById('submitWeightBtn').addEventListener('click', () => {
        const weight = document.getElementById('weightInput').value;

        const rows = buyerInfoTable.querySelectorAll('tr');
        const username = getText(rows[0]?.children[1]);
        const email = rows[1]?.children[1]?.textContent.trim();
        const address = rows[2]?.children[1]?.innerText.trim();
        const phone = getText(rows[3]?.children[1]);

        const payload = {
            username,
            email,
            address,
            phone,
            weight
        };

        fetch('https://example.com/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => alert('Submitted successfully!'))
            .catch(err => {
                console.error(err);
                alert('Submission failed!');
            });
    });
})();
