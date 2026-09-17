package com.vastbricks.api.orderarchive;

import com.vastbricks.api.orderarchive.VatInvoicePayload.OutstandingResponse;
import com.vastbricks.api.orderarchive.VatInvoicePayload.StoredVatInvoice;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The exchange that gets BrickLink's VAT invoices into the store's archive: what is missing, and here it is.
 *
 * <p>An archive endpoint rather than an order one. The invoice is one of the order's archived files, and the only
 * one the nightly run cannot fetch for itself.
 *
 * <p>Both ends are meant for the browser extension rather than for a person, because BrickLink serves the invoice
 * only to a signed-in store and nothing else can reach it. The extension asks the first on whatever BrickLink page
 * it happens to be on, downloads whatever it names, and posts each one back to the second. Both are private, so an
 * API key generated in the portal is what authenticates it and is also what says which store's archive it is
 * filling - the extension names no tenant of its own.
 */
@RestController
@RequestMapping(value = "/api/private/vat-invoices", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VatInvoiceController {

    private final VatInvoiceService vatInvoices;

    @GetMapping("/outstanding")
    OutstandingResponse outstanding() {
        return new OutstandingResponse(vatInvoices.outstanding());
    }

    /**
     * Files one order's invoice, sent as the request body.
     *
     * <p>The PDF is the body rather than a multipart part for the reason the bank statement's document is: a
     * multipart upload would need Spring's default part cap raised in both launchers, and the sender has the bytes in
     * hand either way.
     */
    @PostMapping(value = "/{orderId}", consumes = MediaType.APPLICATION_PDF_VALUE)
    StoredVatInvoice store(@PathVariable("orderId") String orderId, @RequestBody byte[] pdf) {
        return vatInvoices.store(orderId, pdf);
    }

    @ExceptionHandler(VatInvoiceNotFoundException.class)
    ProblemDetail handleUnknownOrder(VatInvoiceNotFoundException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
        problem.setTitle("Unknown order");
        return problem;
    }

    @ExceptionHandler(VatInvoiceException.class)
    ProblemDetail handleRefusedInvoice(VatInvoiceException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Invalid VAT invoice");
        return problem;
    }
}
