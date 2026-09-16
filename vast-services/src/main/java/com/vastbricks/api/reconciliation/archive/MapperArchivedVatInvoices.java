package com.vastbricks.api.reconciliation.archive;

import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Marks each collected order the archive holds a VAT invoice for.
 *
 * <p>Only the orders it holds one for, so an order it says nothing about is left stating nothing rather than stating
 * that no invoice exists. Whether an order should have one is a rule's decision: the archive knows what it has, not
 * what was due.
 */
@Component
class MapperArchivedVatInvoices implements DetailMapper<SourcedArchivedVatInvoice> {

    @Override
    public Class<SourcedArchivedVatInvoice> type() {
        return SourcedArchivedVatInvoice.class;
    }

    @Override
    public void map(List<SourcedArchivedVatInvoice> sourced, ReconciledOrders orders) {
        for (var archived : sourced) {
            orders.find(Marketplace.BRICK_LINK, archived.getOrderId())
                    .forEach(order -> order.getArchive().setVatInvoice(true));
        }
    }
}
