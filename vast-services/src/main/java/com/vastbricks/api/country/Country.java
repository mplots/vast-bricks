package com.vastbricks.api.country;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One ISO 3166-1 country, seeded once from the JDK's own locale data.
 *
 * <p>No {@code @TenantId}, as {@code CurrencyRate} carries none: a country belongs to no tenant, and is the same
 * country for every store.
 */
@Entity
@Table(name = "countries", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class Country {

    /** The ISO 3166-1 alpha-2 code, e.g. {@code LV} - not generated, since the seed states one for every row. */
    @Id
    @Column(length = 2, updatable = false)
    private String code;

    /** The country's own English name, as the JDK's locale data states it. */
    @Column(nullable = false, updatable = false)
    private String name;

    /**
     * Every spelling that resolves to this country - the name and the alpha-2 and alpha-3 codes to start, and
     * whatever alias a real order is later found to state. Matched case-insensitively by {@link Countries#resolve}.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "search_terms", nullable = false)
    private List<String> searchTerms;
}
