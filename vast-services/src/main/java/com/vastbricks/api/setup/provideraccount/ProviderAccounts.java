package com.vastbricks.api.setup.provideraccount;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What another feature may ask of the serving tenant's provider accounts. Everything else about them - their
 * credentials above all - stays inside this package, so a feature that needs a provider's data asks its client, not
 * this.
 */
@Service
@RequiredArgsConstructor
public class ProviderAccounts {

    private final ProviderAccountRepository providerAccountRepository;

    /**
     * The stretch of this provider's data that counts for the serving tenant.
     *
     * <p>Never null: a tenant with no such account, and one whose account bounds nothing, both answer a period with
     * neither date, which restricts nothing. An account that is disabled still answers its period - a store's dates
     * are a fact about the store rather than about whether it is being read just now.
     */
    @Transactional(readOnly = true)
    public OperatingPeriod operatingPeriod(Provider provider) {
        return providerAccountRepository.findFirstByProviderOrderBySortOrderAsc(provider)
                .map(account -> account.getConfig().operatingPeriod())
                .orElseGet(OperatingPeriod::new);
    }
}
