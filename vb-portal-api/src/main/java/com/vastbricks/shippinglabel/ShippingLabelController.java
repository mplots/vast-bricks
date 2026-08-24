package com.vastbricks.shippinglabel;

import lombok.AllArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;

@RestController
@AllArgsConstructor
class ShippingLabelController {
    private BricklinkShippingRequestService service;
    private BrickOwlShippingRequestService brickOwlService;

    @CrossOrigin(origins = "https://www.bricklink.com")
    @PostMapping(
        value = {"/api/bricklink/shipping-request", "/api/shipping-label/bricklink"},
        consumes = MediaType.APPLICATION_JSON_VALUE
    )
    ResponseEntity<byte[]> prepareBricklinkShipping(@RequestBody BricklinkShippingRequest request) {
        return shippingLabelResponse(service.prepareShippingLabel(request));
    }

    @CrossOrigin(origins = "https://www.bricklink.com")
    @PostMapping(
        value = {"/api/bricklink/shipping-request", "/api/shipping-label/bricklink"},
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    ResponseEntity<byte[]> prepareBricklinkShipping(
        @RequestParam("orderId") Long orderId,
        @RequestParam("weight") BigDecimal weight,
        @RequestParam(value = "vatInvoiceFilename", required = false) String vatInvoiceFilename,
        @RequestParam(value = "vatInvoiceFile", required = false) MultipartFile vatInvoiceFile
    ) throws IOException {
        var request = new BricklinkShippingRequest();
        request.setOrderId(orderId);
        request.setWeight(weight);
        request.setVatInvoiceFilename(vatInvoiceFilename);
        if (vatInvoiceFile != null) {
            request.setVatInvoicePdf(vatInvoiceFile.getBytes());
        }
        return shippingLabelResponse(service.prepareShippingLabel(request));
    }

    @CrossOrigin(origins = "https://www.brickowl.com")
    @PostMapping(
        value = "/api/shipping-label/brickowl",
        consumes = MediaType.APPLICATION_JSON_VALUE
    )
    ResponseEntity<byte[]> prepareBrickOwlShipping(@RequestBody BrickOwlShippingRequest request) {
        return shippingLabelResponse(brickOwlService.prepareShippingLabel(request));
    }

    @CrossOrigin(origins = "https://www.brickowl.com")
    @PostMapping(
        value = "/api/shipping-label/brickowl",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    ResponseEntity<byte[]> prepareBrickOwlShipping(
        @RequestParam("orderId") String orderId,
        @RequestParam("weight") BigDecimal weight,
        @RequestParam(value = "vatInvoiceFilename", required = false) String vatInvoiceFilename,
        @RequestParam(value = "vatInvoiceFile", required = false) MultipartFile vatInvoiceFile
    ) throws IOException {
        var request = new BrickOwlShippingRequest();
        request.setOrderId(orderId);
        request.setWeight(weight);
        request.setVatInvoiceFilename(vatInvoiceFilename);
        if (vatInvoiceFile != null) {
            request.setVatInvoicePdf(vatInvoiceFile.getBytes());
        }
        return shippingLabelResponse(brickOwlService.prepareShippingLabel(request));
    }

    private ResponseEntity<byte[]> shippingLabelResponse(ShippingLabelResult result) {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.add("Access-Control-Expose-Headers", "X-Mans-Pasts-Package-Id,X-Mans-Pasts-Barcode");
        if (StringUtils.isNotBlank(result.packageId())) {
            headers.add("X-Mans-Pasts-Package-Id", result.packageId());
        }
        if (StringUtils.isNotBlank(result.barcode())) {
            headers.add("X-Mans-Pasts-Barcode", result.barcode());
        }

        return ResponseEntity.ok().headers(headers).body(result.pdf());
    }
}
