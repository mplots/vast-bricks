package com.vastbricks.api.currencyrate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * How much of a currency one euro bought on one day, as the European Central Bank published it.
 *
 * <p>No {@code @TenantId}, as {@code ShippingPrice} carries none: an ECB reference rate is published once for the
 * whole world, is fetched with no credential, and is owned by no tenant. See {@code vast-docs/currency-rates.md}.
 *
 * <p>One row per currency per {@link #rateDate}, written once and never touched again: the ECB does not revise a
 * day once it has published it, so unlike {@code ShippingPrice} there is no history to close and reopen here - the
 * date itself is the history.
 */
@Entity
@Table(name = "currency_rates", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class CurrencyRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ISO 4217 code of the quoted currency. The base side is always EUR, so it is not stored as a column. */
    @Column(nullable = false, length = 3, updatable = false)
    private String currency;

    /** The date the ECB published this rate for, not the day the sync happened to run. */
    @Column(name = "rate_date", nullable = false, updatable = false)
    private LocalDate rateDate;

    /** How much of {@link #currency} one euro bought on {@link #rateDate}, exactly as the ECB stated it. */
    @Column(nullable = false, precision = 19, scale = 6, updatable = false)
    private BigDecimal rate;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt = Instant.now();
}
