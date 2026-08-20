package com.vastbricks.controller;

import com.vastbricks.accounting.AccountingSummary;
import com.vastbricks.archives.ArchiveOrder;
import com.vastbricks.archives.ArchivesService;
import com.vastbricks.job.BrickLinkOrderArchiveJob;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;

@Controller
@RequiredArgsConstructor
public class ArchivesController {
    private final ArchivesService archivesService;
    private final BrickLinkOrderArchiveJob archiveJob;

    @GetMapping("/archives")
    public String archives(
            @RequestParam(value = "month", required = false) String requestedMonth,
            Model model
    ) {
        var month = parseMonth(requestedMonth);
        var orders = archivesService.findOrders(month);
        model.addAttribute("selectedMonth", month.toString());
        model.addAttribute("orders", orders);
        model.addAttribute(
            "summary",
            AccountingSummary.from(orders.stream().map(ArchiveOrder::getOrder).toList())
        );
        return "archives";
    }

    @PostMapping("/archives/{orderId}/download-missing")
    public String downloadMissingArchives(
        @PathVariable("orderId") long orderId,
        @RequestParam("month") String requestedMonth,
        RedirectAttributes redirectAttributes
    ) throws IOException {
        var month = parseMonth(requestedMonth);
        archiveJob.archiveOrder(orderId);
        redirectAttributes.addAttribute("month", month.toString());
        return "redirect:/archives";
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
