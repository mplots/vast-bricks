package com.vastbricks.controller;

import com.vastbricks.accounting.AccountingService;
import com.vastbricks.accounting.AccountingSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;

@Controller
@RequiredArgsConstructor
public class AccountingController {
    private final AccountingService accountingService;

    @GetMapping("/accounting")
    public String accounting(
            @RequestParam(value = "month", required = false) String requestedMonth,
            Model model
    ) {
        var month = parseMonth(requestedMonth);
        var orders = accountingService.findOrders(month);
        model.addAttribute("selectedMonth", month.toString());
        model.addAttribute("orders", orders);
        model.addAttribute("summary", AccountingSummary.from(orders));
        return "accounting";
    }

    YearMonth parseMonth(String value) {
        if (value == null || value.isBlank()) {
            return YearMonth.now().minusMonths(1);
        }
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must use YYYY-MM format", ex);
        }
    }
}
