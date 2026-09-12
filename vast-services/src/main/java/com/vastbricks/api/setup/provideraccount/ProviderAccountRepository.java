package com.vastbricks.api.setup.provideraccount;

import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface ProviderAccountRepository extends JpaRepository<ProviderAccount, Long> {

    /** The tenant's own arrangement. Name breaks a tie, because {@code sort_order} is not unique. */
    List<ProviderAccount> findAllByOrderBySortOrderAscNameAsc();

    /** The account sitting last, so a new one can be appended after it. */
    Optional<ProviderAccount> findFirstByOrderBySortOrderDesc();

    Optional<ProviderAccount> findByNameIgnoreCase(String name);

    /** Whether the tenant already holds an account with this provider, which is all that most providers may have. */
    boolean existsByProvider(Provider provider);

    /** The tenant's account with this provider. First by arrangement, which for the providers that allow only one
     * account is simply that one. */
    Optional<ProviderAccount> findFirstByProviderOrderBySortOrderAsc(Provider provider);
}
