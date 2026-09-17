package com.vastbricks.api.shippingprice;

import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The tariff table.
 *
 * <p>Unlike every other repository here, these queries carry no tenant and Hibernate adds none: the entity has no
 * {@code @TenantId} because a published tariff belongs to no store.
 */
@DependsOn("vastDatabaseMigration")
interface ShippingPriceRepository extends JpaRepository<ShippingPrice, Long> {

    /** The destination of a current price, for listing the destinations without reading their prices. */
    interface CountryView {
        String getCountryCode();

        String getCountryName();
    }

    /** Every price currently in force, which is what a sweep reads to know what it is comparing against. */
    List<ShippingPrice> findByValidToIsNull();

    /** One destination's current prices, in the order the screen lays them out. */
    List<ShippingPrice> findByCountryCodeAndValidToIsNullOrderByShipmentTypeAscServiceAscWeightToGramsAsc(
            String countryCode
    );

    /** The destinations there are prices for, each named once, alphabetically. */
    List<CountryView> findDistinctByValidToIsNullOrderByCountryNameAsc();

    /** The least recently confirmed current price, which is what says whether a sweep is due. */
    Optional<ShippingPrice> findFirstByValidToIsNullOrderByCheckedAtAsc();
}
