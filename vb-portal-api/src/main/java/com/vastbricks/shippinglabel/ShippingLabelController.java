package com.vastbricks.shippinglabel;

import lombok.AllArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@AllArgsConstructor
class ShippingLabelController {
    private BricklinkShippingRequestService service;
    private BrickOwlShippingRequestService brickOwlService;

    @CrossOrigin(origins = "https://www.bricklink.com")
    @PostMapping({"/api/bricklink/shipping-request", "/api/shipping-label/bricklink"})
    ResponseEntity<byte[]> prepareBricklinkShipping(@RequestBody BricklinkShippingRequest request) {
        return shippingLabelResponse(service.prepareShippingLabel(request));
    }

    @CrossOrigin(origins = "https://www.brickowl.com")
    @PostMapping("/api/shipping-label/brickowl")
    ResponseEntity<byte[]> prepareBrickOwlShipping(@RequestBody BrickOwlShippingRequest request) {
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
