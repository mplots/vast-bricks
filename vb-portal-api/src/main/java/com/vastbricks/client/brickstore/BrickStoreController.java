package com.vastbricks.client.brickstore;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Locale;

@RestController
@RequestMapping("/api/brickstore")
@RequiredArgsConstructor
public class BrickStoreController {
    private final BrickStoreClient brickStoreClient;

    @GetMapping(value = "/orders", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<byte[]> exportOrders(
            @RequestParam(value = "action", defaultValue = "save") String action,
            @RequestParam(value = "orderType", defaultValue = "received") String orderType,
            @RequestParam(value = "viewType", defaultValue = "X") String viewType,
            @RequestParam(value = "getStatusSel", defaultValue = "I") String getStatusSel,
            @RequestParam(value = "getFiled", defaultValue = "Y") String getFiled,
            @RequestParam(value = "getDetail", required = false) String getDetail,
            @RequestParam(value = "getDateFormat", defaultValue = "0") String getDateFormat,
            @RequestParam(value = "includeMyCost", defaultValue = "Y") String includeMyCost,
            @RequestParam(value = "getOrders", required = false) String getOrders,
            @RequestParam(value = "fMM", required = false) Integer fromMonth,
            @RequestParam(value = "fDD", required = false) Integer fromDay,
            @RequestParam(value = "fYY", required = false) Integer fromYear,
            @RequestParam(value = "tMM", required = false) Integer toMonth,
            @RequestParam(value = "tDD", required = false) Integer toDay,
            @RequestParam(value = "tYY", required = false) Integer toYear,
            @RequestParam(value = "orderID", required = false) String orderId
    ) {
        var type = parseOrderType(orderType);
        final OrderExportRequest request;
        try {
            var from = date("f", fromYear, fromMonth, fromDay);
            var to = date("t", toYear, toMonth, toDay);
            validateSelection(from, to, orderId);
            request = OrderExportRequest.builder()
                    .action(action)
                    .orderType(type)
                    .viewType(viewType)
                    .getStatusSel(getStatusSel)
                    .getFiled(getFiled)
                    .getDetail(getDetail)
                    .getDateFormat(getDateFormat)
                    .includeMyCost(includeMyCost)
                    .getOrders(getOrders)
                    .fromDate(from)
                    .toDate(to)
                    .orderId(orderId == null ? null : orderId.trim())
                    .build();
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }

        var body = brickStoreClient.exportOrders(request);
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_XML);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("bricklink-orders-" + type.name().toLowerCase(Locale.ROOT) + ".xml")
                .build());
        return new ResponseEntity<>(body, headers, HttpStatus.OK);
    }

    @ExceptionHandler(BrickStoreClientException.class)
    public ProblemDetail handleBrickStoreClientException(BrickStoreClientException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, ex.getMessage());
    }

    private void validateSelection(LocalDate from, LocalDate to, String orderId) {
        if (from != null || to != null) {
            if (from == null || to == null) {
                throw new IllegalArgumentException("Both from and to date fields are required");
            }
            if (from.isAfter(to)) {
                throw new IllegalArgumentException("From date must not be after to date");
            }
            if (orderId != null && !orderId.isBlank()) {
                throw new IllegalArgumentException("Use either orderID or a date range, not both");
            }
        }
    }

    private LocalDate date(String prefix, Integer year, Integer month, Integer day) {
        if (year == null && month == null && day == null) {
            return null;
        }
        if (year == null || month == null || day == null) {
            throw new IllegalArgumentException(prefix + "YY, " + prefix + "MM and " + prefix + "DD are required together");
        }
        return LocalDate.of(year, month, day);
    }

    private OrderType parseOrderType(String value) {
        try {
            return OrderType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "orderType must be received or placed",
                    ex
            );
        }
    }
}
