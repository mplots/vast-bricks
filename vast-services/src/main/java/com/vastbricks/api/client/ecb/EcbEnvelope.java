package com.vastbricks.api.client.ecb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.Data;

/**
 * The shape of the ECB's {@code eurofxref-daily.xml}, as much of it as a sync reads.
 *
 * <p>Mapped by element local name, as {@code BankStatementDocument} maps camt: the document declares a default
 * namespace and a {@code gesmes} one, and neither is worth handling since every element read here is read the same
 * whichever namespace the parser thinks it belongs to.
 *
 * <p>Three levels nest under the name {@code Cube} - the envelope's own wrapper, the one dated cube for the day, and
 * the rates inside it - which is the document's own shape and not a choice made here. Jackson tells them apart by
 * where each field sits in this tree rather than by the tag name, which is why three classes exist for one word.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JacksonXmlRootElement(localName = "Envelope")
class EcbEnvelope {

    @JacksonXmlProperty(localName = "Cube")
    private OuterCube cube;

    /** The one day this envelope states, and what it gives for every currency it quotes. */
    EcbDailyRates dailyRates() {
        DatedCube dated = cube == null ? null : cube.getDated();
        if (dated == null || dated.getTime() == null || dated.getTime().isBlank()) {
            throw new EcbClientException("The ECB envelope states no reference date");
        }

        LocalDate rateDate;
        try {
            rateDate = LocalDate.parse(dated.getTime().trim());
        } catch (DateTimeParseException exception) {
            throw new EcbClientException("The ECB envelope states an unreadable date: " + dated.getTime(), exception);
        }

        Map<String, BigDecimal> rates = new LinkedHashMap<>();
        for (RateCube entry : dated.getRates() == null ? List.<RateCube>of() : dated.getRates()) {
            if (entry.getCurrency() == null || entry.getRate() == null) {
                continue;
            }
            String currency = entry.getCurrency().trim();
            try {
                rates.put(currency, new BigDecimal(entry.getRate().trim()));
            } catch (NumberFormatException exception) {
                throw new EcbClientException(
                        "The ECB envelope states an unreadable rate for " + currency + ": " + entry.getRate(),
                        exception
                );
            }
        }
        if (rates.isEmpty()) {
            throw new EcbClientException("The ECB envelope for " + rateDate + " states no rates");
        }
        return new EcbDailyRates(rateDate, rates);
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OuterCube {

        @JacksonXmlProperty(localName = "Cube")
        private DatedCube dated;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class DatedCube {

        @JacksonXmlProperty(localName = "time", isAttribute = true)
        private String time;

        @JacksonXmlProperty(localName = "Cube")
        @JacksonXmlElementWrapper(useWrapping = false)
        private List<RateCube> rates;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class RateCube {

        @JacksonXmlProperty(localName = "currency", isAttribute = true)
        private String currency;

        @JacksonXmlProperty(localName = "rate", isAttribute = true)
        private String rate;
    }
}
