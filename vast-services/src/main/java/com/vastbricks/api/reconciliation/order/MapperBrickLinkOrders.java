package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.charges.MarketplaceFeeAmounts;
import com.vastbricks.api.currencyrate.EuroAmounts;
import com.vastbricks.api.currencyrate.CurrencyRates;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.country.Countries;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.OrderMapper;
import com.vastbricks.api.reconciliation.OrderFields;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationCurrency;
import com.vastbricks.api.reconciliation.ReconciliationPaymentMethod;
import com.vastbricks.api.reconciliation.ReconciliationText;
import com.vastbricks.api.charges.FacilitatorTaxes;
import com.vastbricks.api.charges.OrderTaxTypes;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Turns the exported BrickLink orders into reconciled orders. The buyer username arrives with its own mapper. */
@Component
@Order(1)
@RequiredArgsConstructor
class MapperBrickLinkOrders implements OrderMapper<SourcedBrickLinkOrder> {

    private final Countries countries;
    private final CurrencyRates currencyRates;
    private final MarketplaceFeeAmounts marketplaceFees;

    @Override
    public Class<SourcedBrickLinkOrder> type() {
        return SourcedBrickLinkOrder.class;
    }

    @Override
    public List<ReconciledOrder> map(List<SourcedBrickLinkOrder> sourced) {
        return sourced.stream().map(this::toReconciledOrder).toList();
    }

    private ReconciledOrder toReconciledOrder(SourcedBrickLinkOrder sourced) {
        var order = sourced.getOrder();
        var amounts = new EuroAmounts(currencyRates);
        var currency = order.getBaseCurrencyCode();
        var date = order.getOrderDate();
        var orderId = order.getOrderId() == null ? null : order.getOrderId().toString();
        var reconciled = ReconciledOrder.of(OrderFields.builder()
                .source(Marketplace.BRICK_LINK)
                .orderId(orderId)
                .orderDate(order.getOrderDate())
                .buyer(ReconciliationText.normalize(order.getBuyer()))
                .country(countryOf(order))
                .itemCount(order.getTotalItems())
                .lotCount(order.getTotalLots())
                .paymentMethod(ReconciliationPaymentMethod.normalize(order.getPaymentType()))
                .currency(ReconciliationCurrency.normalize(order.getPaymentCurrencyCode()))
                .taxType(OrderTaxTypes.of(order))
                .facilitatorTax(amounts.convert(FacilitatorTaxes.of(order), currency, date))
                .subTotal(amounts.convert(order.getTotal(), currency, date))
                .shippingCost(amounts.convert(order.getShipping(), currency, date))
                .grandTotal(amounts.convert(order.getBaseGrandTotal(), currency, date))
                // A page stating no refund, and an order no page was asked for, both leave the field absent: that is
                // already the marketplace saying no money came back.
                .refundedAmount(sourced.getRefund() == null ? null : amounts.convert(
                        sourced.getRefund().getAmount(), sourced.getRefund().getCurrency(), date))
                .build());
        // Calculated from the order itself rather than collected, so it belongs to the calculated group; set here,
        // the one point this mapper still holds the marketplace's own order.
        reconciled.setMarketplaceFee(marketplaceFees.brickLinkInEur(order.getBaseGrandTotal(), currency, date));
        reconciled.setCurrencyConversionMissing(amounts.isIncomplete());
        return reconciled;
    }

    /**
     * The country BrickLink's own export names first in its free-text location, {@code "Latvia, Riga"} - the only
     * country signal this mapper has, since it reads the accounting export rather than BrickLink's API record, which
     * is where a clean code lives instead. Null where the export states no location, or where nothing in
     * {@link Countries} lists what it names.
     */
    private String countryOf(BrickStoreOrder order) {
        String location = StringUtils.trimToNull(order.getLocation());
        if (location == null) {
            return null;
        }
        String countryName = location.split(",", 2)[0].trim();
        return countries.resolve(countryName).orElse(null);
    }

}
