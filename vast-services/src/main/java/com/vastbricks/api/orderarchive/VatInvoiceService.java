package com.vastbricks.api.orderarchive;

import com.vastbricks.api.orderarchive.VatInvoicePayload.OutstandingOrder;
import com.vastbricks.api.orderarchive.VatInvoicePayload.StoredVatInvoice;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Which orders the archive is still missing a VAT invoice for, and taking delivery of one.
 *
 * <p>Another way of archiving rather than a feature of its own. Were the invoice fetchable it would be written by
 * the nightly run beside the order's other files, exactly as the detail page is; BrickLink serves it only to the
 * signed-in store, so the archive states what it still wants and takes what is posted back to it. This is the pair
 * of questions that exchange needs: what is missing, and here it is.
 */
@Service
@RequiredArgsConstructor
@Slf4j
class VatInvoiceService {

    /** What a PDF carries at its head. An error page served in place of a download is what this actually catches. */
    private static final byte[] PDF_MARKER = {'%', 'P', 'D', 'F'};

    /** How far in to look for it, as {@code BrickStoreClient} looks: not every document starts on the marker. */
    private static final int PDF_SEARCH_LENGTH = 1024;

    private final VatInvoiceOrders orders;
    private final OrderArchive archive;

    /** Every order of the bound tenant BrickLink issues a VAT invoice for that the archive does not hold one of. */
    List<OutstandingOrder> outstanding() {
        Set<String> archived = archive.vatInvoiceOrderIds();
        return orders.invoiced().stream()
                .filter(order -> !archived.contains(order.getOrderId()))
                .map(order -> new OutstandingOrder(order.getOrderId(), order.getOrderDate()))
                .toList();
    }

    /**
     * Files the invoice posted for one order, beside the rest of that order's archive.
     *
     * <p>The order has to be one this store holds, because the moment the archive names its files after is the
     * order's: an invoice for an order nothing was archived for has nowhere to file itself.
     */
    StoredVatInvoice store(String orderId, byte[] pdf) {
        if (pdf == null || pdf.length == 0) {
            throw new VatInvoiceException("A VAT invoice was posted with no document in it.");
        }
        if (!isPdf(pdf)) {
            // BrickLink answers a request it does not recognise as signed-in with a page rather than a refusal, and
            // that page would otherwise be archived as this order's invoice and never asked for again.
            throw new VatInvoiceException("What was posted as the VAT invoice of order " + orderId + " is not a PDF.");
        }

        VatInvoiceOrder order = orders.byOrderId(orderId)
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
