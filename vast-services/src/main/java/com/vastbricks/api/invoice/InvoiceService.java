package com.vastbricks.api.invoice;

import com.vastbricks.api.client.manakabata.ManakabataClient;
import com.vastbricks.api.client.manakabata.model.ClientResource;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Generates the accounting invoice for one marketplace order: the order is looked up at its marketplace, its buyer is
 * upserted as an accounting client, and the invoice is created carrying the order key in its note so reconciliation
 * can match the two later.
 */
@Component
@RequiredArgsConstructor
class InvoiceService {

    private final List<InvoiceOrderSource> orderSources;
    private final InvoiceRequestFactory invoiceRequestFactory;
    private final ManakabataClient manakabataClient;

    GenerateInvoiceResult generateInvoice(String orderId, String source) {
        var normalizedOrderId = InvoiceOrderText.required(orderId, "orderId is required");
        var marketplace = InvoiceOrderMarketplace.of(source);

        var order = orderSource(marketplace).findOrder(normalizedOrderId);
        var client = upsertClient(order);
        var invoice = manakabataClient.createInvoice(invoiceRequestFactory.invoiceRequest(
                client.getUuid(),
                order,
                marketplace.key() + ":" + normalizedOrderId
        ));
        return new GenerateInvoiceResult(
                invoice.getUuid(),
                invoice.getInvoiceNumber(),
                client.getUuid(),
                order.getReferenceId(),
                order.getName()
        );
    }

    /** A buyer who has ordered before already has a client, which is updated rather than duplicated. */
    private ClientResource upsertClient(InvoiceOrder order) {
        var request = invoiceRequestFactory.clientRequest(order);
        return manakabataClient.findClientByReferenceId(order.getReferenceId())
                .map(existing -> manakabataClient.updateClient(existing, request))
                .orElseGet(() -> manakabataClient.createClient(request));
    }

    private InvoiceOrderSource orderSource(InvoiceOrderMarketplace marketplace) {
        return orderSources.stream()
                .filter(orderSource -> orderSource.marketplace() == marketplace)
                .findFirst()
                .orElseThrow(() -> new InvoiceException("Unsupported order source: " + marketplace.key()));
    }
}
