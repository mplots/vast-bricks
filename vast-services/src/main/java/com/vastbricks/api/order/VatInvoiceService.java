package com.vastbricks.api.order;

import com.vastbricks.api.order.VatInvoicePayload.OutstandingOrder;
import com.vastbricks.api.order.VatInvoicePayload.StoredVatInvoice;
import com.vastbricks.api.orderarchive.OrderArchive;
import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.tax.OrderTaxType;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Which orders the store still owes a VAT invoice for, and taking delivery of one.
 *
 * <p>BrickLink issues an invoice for the orders it collected the VAT on itself, and serves it only to the signed-in
 * store, so the store's own copy cannot be fetched by this application at all - the browser extension downloads it
 * from the page and posts it back. This is the pair of questions that exchange needs: what is missing, and here it
 * is.
 *
 * <p>Which orders those are is read from the stored orders rather than from either marketplace. The import has
 * already typed every order it wrote, so the answer is one query against rows this store owns instead of a live call
 * per order to a provider that rate-limits - and an extension asking on every page it is opened on must cost
 * approximately nothing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
class VatInvoiceService {

    /** What a PDF carries at its head. An error page served in place of a download is what this actually catches. */
    private static final byte[] PDF_MARKER = {'%', 'P', 'D', 'F'};

    /** How far in to look for it, as {@code BrickStoreClient} looks: not every document starts on the marker. */
    private static final int PDF_SEARCH_LENGTH = 1024;

    private final OrderRepository orders;
    private final OrderArchive archive;

    /**
     * Every export-taxable BrickLink order of the bound tenant whose invoice the archive does not hold.
     *
     * <p>Export-taxable is the whole of what BrickLink issues an invoice for: it is the type given to a sale outside
     * the EU that the marketplace taxed all the same, which is to say the one it collected the tax on. An order of
     * any other type is not missing an invoice, it is an order there was never going to be one for.
     */
    @Transactional(readOnly = true)
    List<OutstandingOrder> outstanding() {
        Set<String> archived = archive.vatInvoiceOrderIds();
        return orders.findBySourceAndTaxTypeOrderByOrderDateDescIdDesc(OrderSource.BRICKLINK, OrderTaxType.EXPORT_TAXABLE)
                .stream()
                .filter(order -> !archived.contains(order.getOrderId()))
                .map(order -> new OutstandingOrder(order.getOrderId(), order.getOrderDate()))
                .toList();
    }

    /**
     * Files the invoice posted for one order, beside the rest of that order's archive.
     *
     * <p>The order has to be one this store holds, because the moment the archive names its files after is the row's:
     * an invoice for an order nothing was imported for has nowhere to file itself. It does not have to be
     * export-taxable. The archive is a copy of what a marketplace held, a copy too many is a far smaller wrong than
     * a missing one, and an invoice BrickLink issued at all is one worth keeping whatever this store typed the order
     * as.
     */
    @Transactional(readOnly = true)
    StoredVatInvoice store(String orderId, byte[] pdf) {
        if (pdf == null || pdf.length == 0) {
            throw new VatInvoiceException("A VAT invoice was posted with no document in it.");
        }
        if (!isPdf(pdf)) {
            // BrickLink answers a request it does not recognise as signed-in with a page rather than a refusal, and
            // that page would otherwise be archived as this order's invoice and never asked for again.
            throw new VatInvoiceException("What was posted as the VAT invoice of order " + orderId + " is not a PDF.");
        }

        Order order = orders.findBySourceAndOrderId(OrderSource.BRICKLINK, orderId)
                .orElseThrow(() -> new VatInvoiceNotFoundException("This store holds no BrickLink order " + orderId + "."));
        boolean stored = archive.storeVatInvoice(order.getOrderId(), order.getArchivedAt(), pdf);
        if (!stored) {
            log.info("The archive already holds the VAT invoice of BrickLink order {}", orderId);
        }
        return new StoredVatInvoice(order.getOrderId(), stored);
    }

    private static boolean isPdf(byte[] document) {
        int searchLength = Math.min(document.length, PDF_SEARCH_LENGTH);
        for (int offset = 0; offset <= searchLength - PDF_MARKER.length; offset++) {
            if (Arrays.equals(document, offset, offset + PDF_MARKER.length, PDF_MARKER, 0, PDF_MARKER.length)) {
                return true;
            }
        }
        return false;
    }
}
