package com.vastbricks.accounting.paypal;

import com.paypal.sdk.models.Money;
import com.paypal.sdk.models.SearchResponse;
import com.paypal.sdk.models.SearchTransactionsInput;
import com.paypal.sdk.models.TransactionDetails;
import com.paypal.sdk.models.TransactionInformation;
import com.vastbricks.config.Env;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

@Service
public class PayPalTransactionService {
    private static final int PAGE_SIZE = 500;

    private final Supplier<PayPalTransactionGateway> gatewaySupplier;

    @Autowired
    public PayPalTransactionService(Env env) {
        this(() -> new PayPalTransactionSearchClient(env));
    }

    PayPalTransactionService(Supplier<PayPalTransactionGateway> gatewaySupplier) {
        this.gatewaySupplier = gatewaySupplier;
    }

    public List<PayPalTransaction> findTransactions(YearMonth month) {
        var gateway = gatewaySupplier.get();
        var transactions = new ArrayList<PayPalTransaction>();
        var page = 1;

        while (true) {
            var response = gateway.searchTransactions(searchInput(month, page));
            transactions.addAll(mapTransactions(response));

            var totalPages = response == null ? null : response.getTotalPages();
            if (totalPages == null || page >= totalPages) {
                break;
            }
            page++;
        }

        return transactions;
    }

    private SearchTransactionsInput searchInput(YearMonth month, int page) {
        return new SearchTransactionsInput.Builder(
                format(month.atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC)),
                format(month.atEndOfMonth().atTime(23, 59, 59).atOffset(ZoneOffset.UTC))
        )
                .fields("all")
                .balanceAffectingRecordsOnly("Y")
                .pageSize(PAGE_SIZE)
                .page(page)
                .build();
    }

    private String format(OffsetDateTime dateTime) {
        return DateTimeFormatter.ISO_INSTANT.format(dateTime);
    }

    private List<PayPalTransaction> mapTransactions(SearchResponse response) {
        if (response == null || response.getTransactionDetails() == null) {
            return List.of();
        }
        return response.getTransactionDetails().stream()
                .filter(details -> details.getTransactionInfo() != null)
                .map(this::mapTransaction)
                .toList();
    }

    private PayPalTransaction mapTransaction(TransactionDetails details) {
        var info = details.getTransactionInfo();
        var transactionDateTime = transactionDateTime(info.getTransactionInitiationDate());
        return new PayPalTransaction(
                info.getTransactionId(),
                info.getPaypalReferenceId(),
                transactionDate(transactionDateTime),
                transactionDateTime,
                info.getTransactionEventCode(),
                info.getTransactionStatus(),
                amount(info.getTransactionAmount()),
                amount(info.getFeeAmount()),
                currency(info.getTransactionAmount()),
                info.getInvoiceId(),
                info.getCustomField(),
                info.getTransactionSubject(),
                payerName(details),
                shippingName(details)
        );
    }

    private String payerName(TransactionDetails details) {
        if (details.getPayerInfo() == null || details.getPayerInfo().getPayerName() == null) {
            return null;
        }
        var name = details.getPayerInfo().getPayerName();
        if (name.getAlternateFullName() != null && !name.getAlternateFullName().isBlank()) {
            return name.getAlternateFullName();
        }
        if (name.getFullName() != null && !name.getFullName().isBlank()) {
            return name.getFullName();
        }
        return join(name.getGivenName(), name.getSurname());
    }

    private String shippingName(TransactionDetails details) {
        return details.getShippingInfo() == null ? null : details.getShippingInfo().getName();
    }

    private String join(String first, String second) {
        var value = "%s %s".formatted(
                first == null ? "" : first.trim(),
                second == null ? "" : second.trim()
        ).trim();
        return value.isBlank() ? null : value;
    }

    private OffsetDateTime transactionDateTime(String value) {
        return value == null || value.isBlank() ? null : OffsetDateTime.parse(value);
    }

    private java.time.LocalDate transactionDate(OffsetDateTime value) {
        return value == null ? null : value.toLocalDate();
    }

    private BigDecimal amount(Money money) {
        return money == null || money.getValue() == null ? null : new BigDecimal(money.getValue());
    }

    private String currency(Money money) {
        return money == null ? null : money.getCurrencyCode();
    }
}
