package com.vastbricks.api.country;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Resolves a marketplace's own wording of a country to the ISO 3166-1 alpha-2 code every other feature already
 * states one by - {@code order.country}, BrickOwl's {@code ship_country_code}, and so on.
 *
 * <p>The whole of this feature's public API. Everything else here - the entity, the table - is this class's own
 * implementation detail; a feature wanting a country asks this rather than reading the table itself, exactly as a
 * feature wanting a euro figure asks {@code CurrencyRates} rather than the rate table behind it.
 *
 * <p>This is a platform-wide mapping rather than one feature's own: a term is added here because some real order
 * stated it, not because one particular caller needed it, so every caller shares one growing list rather than each
 * keeping its own.
 */
@Component
@RequiredArgsConstructor
public class Countries {

    private final CountryRepository repository;

    /**
     * The country {@code term} names, matched case-insensitively against every country's own list of search terms,
     * or empty where nothing lists it. A caller holding more than a bare country name - BrickLink's own
     * {@code "Latvia, Riga"}, a name and a city together - splits off the part naming the country before asking;
     * splitting a marketplace's own format is that caller's business, not this one's.
     */
    public Optional<String> resolve(String term) {
        if (term == null || term.isBlank()) {
            return Optional.empty();
        }
        var normalized = term.trim();
        return repository.findAll().stream()
                .filter(country -> country.getSearchTerms().stream().anyMatch(candidate -> candidate.equalsIgnoreCase(normalized)))
                .map(Country::getCode)
                .findFirst();
    }
}
