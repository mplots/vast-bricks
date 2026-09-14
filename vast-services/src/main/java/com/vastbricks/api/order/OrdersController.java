package com.vastbricks.api.order;

import com.vastbricks.api.order.OrderPayload.OrdersResponse;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value = "/api/private/orders", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class OrdersController {

    private final OrderService orderService;

    @GetMapping
    OrdersResponse listOrders(
            @RequestParam(value = "from") String from,
            @RequestParam(value = "to") String to
    ) {
        LocalDate start = day(from, "from");
        LocalDate end = day(to, "to");
        if (start.isAfter(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from must not be after to");
        }
        return new OrdersResponse(start.toString(), end.toString(), orderService.findOrders(start, end));
    }

    private static LocalDate day(String value, String name) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " must be a date as yyyy-MM-dd");
        }
    }
}
