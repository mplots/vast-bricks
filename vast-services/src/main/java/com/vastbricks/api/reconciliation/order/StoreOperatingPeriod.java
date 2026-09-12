package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import com.vastbricks.api.setup.provideraccount.Provider;
import com.vastbricks.api.setup.provideraccount.ProviderAccounts;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The part of a reconciled period a store's own provider account says counts.
 *
 * <p>A marketplace login can hold orders that were never this tenant's - sold personally before the store became a
 * business, or by whoever holds the same login now - so the tenant states the stretch that was its own and everything
 * outside it belongs to somebody else. Two tenants sharing one store's login are told apart by exactly this, which is
 * why the store is asked about the narrowed period rather than the whole of it and the answer filtered afterwards.
 *
 * <p>Empty when the period and the operating period do not meet: the store is then not asked at all, since it could
 * not answer with an order this tenant may reconcile.
 */
@Component
@RequiredArgsConstructor
class StoreOperatingPeriod {

    private final ProviderAccounts providerAccounts;

    Optional<ReconciliationPeriod> narrow(Provider provider, ReconciliationPeriod period) {
        var operatingPeriod = providerAccounts.operatingPeriod(provider);
        return period.boundedBy(operatingPeriod.getFrom(), operatingPeriod.getTo());
    }
}
