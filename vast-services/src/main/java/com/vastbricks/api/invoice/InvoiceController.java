package com.vastbricks.api.invoice;

import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickstore.BrickStoreClientException;
import com.vastbricks.api.client.manakabata.ManakabataClientException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
// The path stays under the legacy accounting namespace the portal already calls.
@RequestMapping(value = "/api/private/accounting", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Slf4j
class  InvoiceController {

    private final InvoiceService invoiceService;

    @PostMapping("/invoices")
    GenerateInvoiceResult generateInvoice(@RequestBody GenerateInvoiceRequest request) {
        return invoiceService.generateInvoice(request.getOrderId(), request.getSource());
    }

    @ExceptionHandler(InvoiceException.class)
    ProblemDetail handleRejectedRequest(InvoiceException exception) {
        log.warn("Invoice generation rejected: {}", exception.getMessage());
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Invoice generation failed");
        return problem;
    }

    @ExceptionHandler({
            ManakabataClientException.class,
            BrickStoreClientException.class,
            BrickOwlClientException.class
    })
    ProblemDetail handleDataSourceException(RuntimeException exception) {
        log.error("Invoice generation failed: {}", exception.getMessage());
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, exception.getMessage());
        problem.setTitle("Invoice generation failed");
        return problem;
    }
}
