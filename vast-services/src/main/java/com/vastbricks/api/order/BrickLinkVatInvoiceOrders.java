package com.vastbricks.api.order;

import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.orderarchive.VatInvoiceOrder;
import com.vastbricks.api.orderarchive.VatInvoiceOrders;
import com.vastbricks.api.charges.OrderTaxType;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Answers the archive's VAT invoice questions out of the stored orders.
 *
 * <p>Export-taxable is the whole of what BrickLink issues an invoice for: it is the type given to a sale outside the
 * EU that the marketplace taxed all the same, which is to say the one it collected the tax on. An order of any other
 * type is not missing an invoice, it is an order there was never going to be one for.
 *
 * <p>Read from the stored orders rather than from the marketplace. The import has already typed every order it
 * wrote, so the answer is one query against rows this store owns instead of a live call per order to a provider that
 * rate-limits - and an extension asking on every page it is opened on must cost approximately nothing.
 *
 * <p>It lives in the orders feature, as {@link SourceStoredOrders} does, because this is the feature that owns the
 * table: the archive declares the boundary and this implements it, so the archive the rows were derived from never
 * reads them back.
 */
@Component
@RequiredArgsConstructor
class BrickLinkVatInvoiceOrders implements VatInvoiceOrders {

    private final OrderRepository orders;

    @Override
    @Transactional(readOnly = true)
    public List<VatInvoiceOrder> invoiced() {
        return orders.findBySourceAndTaxTypeOrderByOrderDateDescIdDesc(OrderSource.BRICKLINK, OrderTaxType.EXPORT_TAXABLE)
                .stream()
                .map(BrickLinkVatInvoiceOrders::stated)
                .toList();
    }

    /**
     * Any BrickLink order of the store, whatever its tax type.
     *
     * <p>An invoice does not have to be posted for an export-taxable order. The archive is a copy of what a
     * marketplace held, a copy too many is a far smaller wrong than a missing one, and an invoice BrickLink issued at
     * all is one worth keeping whatever this store typed the order as.
     */
    @Override
    @Transactional(readOnly = true)
    public Optional<VatInvoiceOrder> byOrderId(String orderId) {
        return orders.findBySourceAndOrderId(OrderSource.BRICKLINK, orderId).map(BrickLinkVatInvoiceOrders::stated);
    }

    private static VatInvoiceOrder stated(Order order) {
        return new VatInvoiceOrder(order.getOrderId(), order.getOrderDate(), order.getArchivedAt());
    }
}
