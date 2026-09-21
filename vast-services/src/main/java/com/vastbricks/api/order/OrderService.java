package com.vastbricks.api.order;

import com.vastbricks.api.charges.MarketplaceFeeAmounts;
import com.vastbricks.api.currencyrate.CurrencyRates;
import com.vastbricks.api.charges.MarketplaceFees;
import com.vastbricks.api.charges.PaymentFees;
import com.vastbricks.api.order.OrderPayload.CountryOrders;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import com.vastbricks.api.order.OrderPayload.OrderResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

/**
 * The store's orders, as the import last left them.
 *
 * <p>It reads and nothing else: the rows are written by {@link OrderImport} out of the archive, so a screen showing
 * them stale is a job that has not run rather than a screen to add a button to.
 */
@Service
@RequiredArgsConstructor
class OrderService {

    private final OrderRepository orders;

    private final CurrencyRates currencyRates;
    private final MarketplaceFeeAmounts marketplaceFees;

    /**
     * The orders placed in a range of days, newest first, for the tenant bound to the request.
     *
     * <p>The marketplace fee is not stated when there is no target invoice at all: a commission is owed on a sale,
     * and nothing left to invoice is nothing left to have sold. The payment fee is not the same question - a
     * provider charges for taking a payment whether or not anything is still owed on it afterwards, a refund among
     * them, so it is calculated regardless.
     */
    List<OrderResponse> findOrders(LocalDate from, LocalDate to) {
        return ordersIn(from, to).stream()
                .map(order -> {
                    var targetInvoice = targetInvoiceOf(order);
                    boolean nothingToInvoice = targetInvoice == null || targetInvoice.signum() == 0;
                    return new OrderResponse(order, targetInvoice,
                            nothingToInvoice ? null : marketplaceFeeOf(order),
                            paymentFeeOf(order), currencyRates);
                })
                .toList();
    }

    /**
     * What this screen calculates Stripe's or PayPal's own charge for taking the payment as, from this row's own
     * payment method, grand total and country - all three already held here exactly as reconciliation collects them,
     * so unlike the marketplace fee this needs no separate stored-row overload and answers the same as
     * {@link com.vastbricks.api.reconciliation.ReconciledOrder}'s own live calculation.
     */
    private BigDecimal paymentFeeOf(Order order) {
        return ReconciliationAmount.normalize(
                PaymentFees.of(order.getPaymentMethod(), euro(order, order.getGrandTotal()), order.getCountry()));
    }

    /**
     * What this screen calculates the marketplace's own commission on the order as, from this row's own amounts
     * rather than the marketplace's own order - the calculation is never stored, so it always reflects the rate
     * schedule as it reads now rather than as it read when the order was imported.
     *
     * <p>BrickLink's total is converted to USD for its fee tiers and the result to EUR. BrickOwl's percentage
     * is applied in the base currency and converted to EUR. Stored rows still lack the non-import tax breakdown
     * used by the live BrickOwl calculation, so its fee remains an approximation.
     */
    private BigDecimal marketplaceFeeOf(Order order) {
        return ReconciliationAmount.normalize(switch (order.getSource()) {
            case BRICKLINK -> marketplaceFees.brickLinkInEur(order.getGrandTotal(), order.getBaseCurrency(), day(order));
            case BRICKOWL -> euro(order, MarketplaceFees.brickOwlOf(order.getGrandTotal(), order.getShippingCost()));
        });
    }

    /**
     * What the accounting invoice for this order has to come to, in euros - the same question the reconciliation
     * report's own target invoice answers, approximated from what this screen holds rather than what reconciliation
     * collects live.
     *
     * <p>Totals and taxes use the marketplace base currency; the refund uses its own reported currency.
     * Missing currency or historical rate leaves the target unknown.
     */
    private BigDecimal targetInvoiceOf(Order order) {
        if (order.getCurrencyVersion() == 0) return null;
        LocalDate orderDay = order.getOrderDate().atZone(ZoneOffset.UTC).toLocalDate();

        // No total at all and a total this cannot convert both answer the same way: there is no target to invoice.
        BigDecimal grandTotal = currencyRates.toEur(order.getGrandTotal(), order.getBaseCurrency(), orderDay);
        if (grandTotal == null) {
            return null;
        }
        BigDecimal facilitatorTax = currencyRates.toEur(order.getFacilitatorTax(), order.getBaseCurrency(), orderDay);
        if (order.getFacilitatorTax() != null && facilitatorTax == null) {
            return null;
        }
        BigDecimal refunded = currencyRates.toEur(order.getRefundedAmount(), order.getRefundCurrency(), orderDay);
        if (order.getRefundedAmount() != null && refunded == null) {
            return null;
        }

        BigDecimal target = grandTotal;
        if (facilitatorTax != null) {
            target = target.subtract(facilitatorTax);
        }
        if (refunded != null) {
            target = target.subtract(refunded);
        }
        return target.max(BigDecimal.ZERO);
    }

    private LocalDate day(Order order) {
        return order.getOrderDate().atZone(ZoneOffset.UTC).toLocalDate();
    }

    private BigDecimal euro(Order order, BigDecimal amount) {
        return order.getCurrencyVersion() == 0 ? null : currencyRates.toEur(amount, order.getBaseCurrency(), day(order));
    }

    /**
     * How many of a range's orders went to each country, the largest share first.
     *
     * <p>Counted over the rows rather than by the database, which is what keeps every query this feature makes a
     * derived one Hibernate can stamp the tenant onto. A store's range is thousands of rows at the very most, and
     * they are rows this tenant is reading either way - the screen beside this one lists the same ones in full.
     */
    List<CountryOrders> findCountries(LocalDate from, LocalDate to) {
        // A HashMap because the orders a marketplace stated no country for are a share of their own, and null is how
        // the row states it. They are one slice the screen names rather than orders left out of the total.
        Map<String, Long> counted = new HashMap<>();
        for (Order order : ordersIn(from, to)) {
            counted.merge(order.getCountry(), 1L, Long::sum);
        }
        return counted.entrySet().stream()
                .map(country -> new CountryOrders(country.getKey(), country.getValue()))
                // Largest first, and by country where two are equal, so a range redrawn reads the same way twice.
                .sorted(Comparator.comparingLong(CountryOrders::getOrders).reversed()
                        .thenComparing(country -> StringUtils.defaultString(country.getCountry())))
                .toList();
    }

    /** The orders of a range of days, newest first. Days in, instants out, which is what the rows are dated by. */
    private List<Order> ordersIn(LocalDate from, LocalDate to) {
        // The day asked for runs to the start of the next one, so an order placed in its last second is in it.
        Instant start = from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return orders.findByOrderDateGreaterThanEqualAndOrderDateLessThanOrderByOrderDateDescIdDesc(start, end);
    }
}
