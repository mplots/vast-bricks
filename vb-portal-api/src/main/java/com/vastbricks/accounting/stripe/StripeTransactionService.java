package com.vastbricks.accounting.stripe;

import com.stripe.model.BalanceTransaction;
import com.stripe.param.BalanceTransactionListParams;
import com.vastbricks.config.Env;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

@Service
public class StripeTransactionService {
    private static final long PAGE_SIZE = 100L;

    private final Supplier<StripeTransactionGateway> gatewaySupplier;

    @Autowired
    public StripeTransactionService(Env env) {
        this(() -> new StripeBalanceTransactionClient(env));
    }

    StripeTransactionService(Supplier<StripeTransactionGateway> gatewaySupplier) {
        this.gatewaySupplier = gatewaySupplier;
    }

    public List<StripeTransaction> findTransactions(YearMonth month) {
        var gateway = gatewaySupplier.get();
        var transactions = new ArrayList<StripeTransaction>();
        String startingAfter = null;

        while (true) {
            var response = gateway.listBalanceTransactions(searchParams(month, startingAfter));
            if (response == null || response.getData() == null || response.getData().isEmpty()) {
                break;
            }

            transactions.addAll(response.getData().stream()
                    .map(this::mapTransaction)
                    .toList());

            if (!Boolean.TRUE.equals(response.getHasMore())) {
                break;
            }
            startingAfter = response.getData().getLast().getId();
        }

        return transactions;
    }

    private BalanceTransactionListParams searchParams(YearMonth month, String startingAfter) {
        var builder = BalanceTransactionListParams.builder()
                .setLimit(PAGE_SIZE)
                .setCreated(BalanceTransactionListParams.Created.builder()
                        .setGte(epochSecond(month.atDay(1).atStartOfDay().atOffset(ZoneOffset.UTC)))
                        .setLte(epochSecond(month.atEndOfMonth().atTime(23, 59, 59).atOffset(ZoneOffset.UTC)))
                        .build());
        if (startingAfter != null) {
            builder.setStartingAfter(startingAfter);
        }
        return builder.build();
    }

    private long epochSecond(OffsetDateTime dateTime) {
        return dateTime.toEpochSecond();
    }

    private StripeTransaction mapTransaction(BalanceTransaction transaction) {
        var transactionDateTime = transactionDateTime(transaction.getCreated());
        return new StripeTransaction(
                transaction.getId(),
                transaction.getSource(),
                transactionDateTime == null ? null : transactionDateTime.toLocalDate(),
                transactionDateTime,
                transaction.getType(),
                transaction.getReportingCategory(),
                transaction.getStatus(),
                transaction.getDescription(),
                normalizeCurrency(transaction.getCurrency()),
                transaction.getAmount(),
                transaction.getFee(),
                transaction.getNet(),
                amount(transaction.getAmount()),
                amount(transaction.getFee()),
                amount(transaction.getNet())
        );
    }

    private OffsetDateTime transactionDateTime(Long epochSecond) {
        return epochSecond == null ? null : OffsetDateTime.ofInstant(Instant.ofEpochSecond(epochSecond), ZoneOffset.UTC);
    }

    private BigDecimal amount(Long minorUnits) {
        return minorUnits == null
                ? null
                : BigDecimal.valueOf(minorUnits).divide(BigDecimal.valueOf(100), 2, RoundingMode.UNNECESSARY);
    }

    private String normalizeCurrency(String value) {
        return value == null ? null : value.toUpperCase();
    }
}
