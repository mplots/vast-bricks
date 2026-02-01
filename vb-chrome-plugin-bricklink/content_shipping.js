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
        <button id="openManspastsBtn">Open Manspasts</button>
        <span id="statusMsg" style="margin-left: 10px; font-weight: bold;"></span>
      </td>
    `;
    buyerInfoTable.querySelector('tbody').appendChild(newRow);

    const btn = document.getElementById('openManspastsBtn');
    const statusMsg = document.getElementById('statusMsg');

    btn.addEventListener('click', () => {
        const weight = document.getElementById('weightInput').value;
        const id = new URL(window.location.href).searchParams.get("ID");
        if (!id) {
            statusMsg.style.color = "red";
            statusMsg.textContent = "Order ID not found!";
            return;
        }
        if (!weight) {
            statusMsg.style.color = "red";
            statusMsg.textContent = "Enter weight!";
            return;
        }
        statusMsg.style.color = "green";
        statusMsg.textContent = "Opening Manspasts...";
        const url = new URL('https://www.manspasts.lv/lv/login');
        url.searchParams.set('orderId', id);
        url.searchParams.set('weight', weight);
        window.open(url.toString(), '_blank', 'noopener');
    });
})();
