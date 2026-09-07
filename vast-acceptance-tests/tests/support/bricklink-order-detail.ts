/**
 * The BrickLink order detail page, in the shape BrickLink renders it. Its refund section is present only when the
 * order has a refund, which is the whole of what the client reads the page for.
 *
 * <p>It is shared by the fixtures that serve the page: the reconciliation one, which serves a page per cancelled
 * order, and the one that addresses the client directly.
 */
export type BrickLinkOrderDetailPage = {
  /** What the page writes inside the "Total refunded" cell, spelled as BrickLink spells it: `EUR&nbsp;12.34`. */
  totalRefunded?: string;
  /** What the refund activity table lists, one line per refund BrickLink recorded against the order. */
  activity?: string[];
};

export function orderDetailPage(orderId: string, page: BrickLinkOrderDetailPage = {}): string {
  return `<HTML><BODY>
<B>Order #${orderId}</B>
<TABLE><TR><TD>Grand Total:</TD><TD><B>EUR&nbsp;98.76</B></TD></TR></TABLE>
${page.totalRefunded === undefined ? '' : refundSection(page.totalRefunded, page.activity ?? [])}
</BODY></HTML>`;
}

function refundSection(totalRefunded: string, activity: string[]): string {
  return `<div><HR NOSHADE SIZE="1" COLOR="#000000"><B>Refund</B></div>
<TABLE WIDTH="100%" BORDER="0" CELLPADDING="5" CELLSPACING="0" class="js-refunded-details">
  <TR><TD>You issued a refund.</TD></TR>
  <tr><td>
    <TABLE WIDTH="100%" BORDER="0" CELLPADDING="2" CELLSPACING="0" BGCOLOR="#eeeeee">
      <tr>
        <td width="120px">Total refunded:</td>
        <td width="48px">&nbsp;</td>
        <td><strong>${totalRefunded}</strong></td>
      </tr>
      <tr>
        <td width="120px">Reason for refund:</td>
        <td width="48px">&nbsp;</td>
        <td>Buyer and Seller agreed to cancel order</td>
      </tr>
      <tr>
        <td width="120px" style="vertical-align: top">Activity:</td>
        <td width="48px">&nbsp;</td>
        <td>
          <table WIDTH="50%" BORDER="0" CELLPADDING="2" CELLSPACING="0">
            <tr><th width="80px"><strong>Date</strong></th><th width="24px">&nbsp;</th><th><strong>Amount refunded</strong></th></tr>
            ${activity.map((amount) => `<tr><td width="80px">Sep 3, 2026</td><td width="24px">&nbsp;</td><td>${amount}</td></tr>`).join('\n            ')}
          </table>
        </td>
      </tr>
    </TABLE>
  </td></tr>
</TABLE>`;
}
