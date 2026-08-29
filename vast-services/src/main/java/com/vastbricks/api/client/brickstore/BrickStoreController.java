package com.vastbricks.api.client.brickstore;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value = "/api/private/brickstore", produces = MediaType.APPLICATION_JSON_VALUE)
public class BrickStoreController {

    private final BrickStoreClient brickStoreClient;
    private final Clock clock;

    BrickStoreController(BrickStoreClient brickStoreClient) {
        this.brickStoreClient = brickStoreClient;
        this.clock = Clock.systemDefaultZone();
    }

    @GetMapping("/orders/{orderId}")
    public BrickStoreOrder getOrder(
            @PathVariable("orderId") String orderId,
            @RequestParam(value = "fromDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(value = "toDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate
    ) {
        LocalDate resolvedToDate = toDate == null ? LocalDate.now(clock) : toDate;
        LocalDate resolvedFromDate = fromDate == null ? resolvedToDate.minusMonths(6) : fromDate;
        List<BrickStoreOrder> orders = brickStoreClient.listOrders(
                BrickStoreOrderExportRequest.forOrderIdInDateRange(
                        BrickStoreOrderType.RECEIVED,
                        orderId,
                        resolvedFromDate,
                        resolvedToDate
                )
        );
        return orders.stream()
                .filter(order -> order.getOrderId() != null && order.getOrderId().toString().equals(orderId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "BrickStore order not found"));
    }

    @ExceptionHandler(BrickStoreClientException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    public String handleBrickStoreClientException(BrickStoreClientException ex) {
        return ex.getMessage();
    }
}
