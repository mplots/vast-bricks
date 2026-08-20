package com.vastbricks.archives;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.accounting.AccountingOrder;
import com.vastbricks.accounting.AccountingService;
import com.vastbricks.config.Env;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArchivesService {
    private static final Pattern API_ARCHIVE = Pattern.compile("^api-(\\d+)-.+\\.json$");
    private static final Pattern ACCOUNTING_ARCHIVE = Pattern.compile("^accounting-(\\d+)-.+\\.xml$");
    private static final Pattern VAT_INVOICE_ARCHIVE = Pattern.compile("^vat-invoice-(\\d+)-.+\\.pdf$");

    private final AccountingService accountingService;
    private final Env env;
    private final ObjectMapper objectMapper;

    public List<ArchiveOrder> findOrders(YearMonth month) {
        var index = archiveIndex();
        return accountingService.findBrickLinkOrders(month).stream()
            .sorted(Comparator
                .comparing(AccountingOrder::getOrderDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(
                    AccountingOrder::getOrderNumber,
                    Comparator.nullsLast(Comparator.reverseOrder())
                ))
            .map(order -> new ArchiveOrder(
                order,
                index.getApiOrderIds().contains(order.getOrderNumber()),
                index.getAccountingOrderIds().contains(order.getOrderNumber()),
                index.vatInvoiceStatus(order.getOrderNumber())
            ))
            .toList();
    }

    private ArchiveIndex archiveIndex() {
        var apiOrderIds = new HashSet<String>();
        var accountingOrderIds = new HashSet<String>();
        var vatInvoiceOrderIds = new HashSet<String>();
        var vatInvoiceRequired = new HashMap<String, Boolean>();
        if (StringUtils.isBlank(env.getBrickLinkOrderArchiveDir())) {
            return new ArchiveIndex(apiOrderIds, accountingOrderIds, vatInvoiceOrderIds, vatInvoiceRequired);
        }

        try {
            var directory = Path.of(env.getBrickLinkOrderArchiveDir().trim());
            if (!Files.isDirectory(directory)) {
                return new ArchiveIndex(apiOrderIds, accountingOrderIds, vatInvoiceOrderIds, vatInvoiceRequired);
            }
            try (var files = Files.list(directory)) {
                files.filter(Files::isRegularFile)
                    .forEach(path -> addToIndex(
                        path,
                        apiOrderIds,
                        accountingOrderIds,
                        vatInvoiceOrderIds,
                        vatInvoiceRequired
                    ));
            }
        } catch (IOException | InvalidPathException ex) {
            log.warn("Could not inspect BrickLink order archive directory", ex);
        }
        return new ArchiveIndex(apiOrderIds, accountingOrderIds, vatInvoiceOrderIds, vatInvoiceRequired);
    }

    private void addToIndex(
        Path path,
        Set<String> apiOrderIds,
        Set<String> accountingOrderIds,
        Set<String> vatInvoiceOrderIds,
        Map<String, Boolean> vatInvoiceRequired
    ) {
        var filename = path.getFileName().toString();
        var apiMatch = API_ARCHIVE.matcher(filename);
        if (apiMatch.matches()) {
            var orderId = apiMatch.group(1);
            apiOrderIds.add(orderId);
            addVatInvoiceRequirement(path, orderId, vatInvoiceRequired);
            return;
        }
        var accountingMatch = ACCOUNTING_ARCHIVE.matcher(filename);
        if (accountingMatch.matches()) {
            accountingOrderIds.add(accountingMatch.group(1));
            return;
        }
        var vatInvoiceMatch = VAT_INVOICE_ARCHIVE.matcher(filename);
        if (vatInvoiceMatch.matches()) {
            vatInvoiceOrderIds.add(vatInvoiceMatch.group(1));
        }
    }

    private void addVatInvoiceRequirement(Path path, String orderId, Map<String, Boolean> vatInvoiceRequired) {
        try {
            var root = objectMapper.readTree(path.toFile());
            if (root == null) {
                return;
            }
            var value = root.path("data").get("vat_collected_by_bl");
            if (value != null && value.isBoolean()) {
                vatInvoiceRequired.merge(orderId, value.booleanValue(), (current, next) -> current || next);
            }
        } catch (IOException ex) {
            log.warn("Could not inspect BrickLink API archive {}", path, ex);
        }
    }

    @Getter
    @AllArgsConstructor
    private static class ArchiveIndex {
        private final Set<String> apiOrderIds;
        private final Set<String> accountingOrderIds;
        private final Set<String> vatInvoiceOrderIds;
        private final Map<String, Boolean> vatInvoiceRequired;

        private VatInvoiceArchiveStatus vatInvoiceStatus(String orderId) {
            if (vatInvoiceOrderIds.contains(orderId)) {
                return VatInvoiceArchiveStatus.AVAILABLE;
            }
            if (Boolean.FALSE.equals(vatInvoiceRequired.get(orderId))) {
                return VatInvoiceArchiveStatus.NOT_REQUIRED;
            }
            return VatInvoiceArchiveStatus.MISSING;
        }
    }
}
