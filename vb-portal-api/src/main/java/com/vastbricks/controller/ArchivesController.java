package com.vastbricks.controller;

import com.vastbricks.accounting.AccountingSummary;
import com.vastbricks.archives.ArchiveOrder;
import com.vastbricks.archives.ArchivesPage;
import com.vastbricks.archives.ArchivesService;
import com.vastbricks.job.BrickLinkOrderArchiveJob;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;

@RestController
@RequiredArgsConstructor
public class ArchivesController {
    private final ArchivesService archivesService;
    private final BrickLinkOrderArchiveJob archiveJob;

    @GetMapping("/api/private/archives")
    public ArchivesPage archives(
        @RequestParam(value = "month", required = false) String requestedMonth
    ) {
        var month = parseMonth(requestedMonth);
        var orders = archivesService.findOrders(month);
        return new ArchivesPage(
            month.toString(),
            orders,
            AccountingSummary.from(orders.stream().map(ArchiveOrder::getOrder).toList())
        );
    }

    @PostMapping("/api/private/archives/{orderId}/download-missing")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void downloadMissingArchives(@PathVariable("orderId") long orderId) throws IOException {
        archiveJob.archiveOrder(orderId);
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
