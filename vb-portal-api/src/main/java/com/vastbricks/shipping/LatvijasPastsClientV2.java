package com.vastbricks.shipping;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.LoggingInterceptor;
import com.vastbricks.market.owl.ShipmentPricing;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static com.vastbricks.shipping.Tariff.Type.DOCUMENT;
import static com.vastbricks.shipping.Tariff.Type.valueOf;

public class LatvijasPastsClientV2 {

    private static final String PRICES_BY_COUNTRY_URL = "https://mans.pasts.lv/api/public/prices/by_country";
    private static final String MISSING_TARIFFS_RESOURCE = "tariff/missing_tariffs.json";

    private final RestTemplate template = new RestTemplate();
    private final List<MissingTariff> missingTariffs;

    public LatvijasPastsClientV2() {
        // Allow multiple reads of the response body
        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));

        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        var jsonConverter = new MappingJackson2HttpMessageConverter();
        jsonConverter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_JSON));
        template.getMessageConverters().add(jsonConverter);

        this.missingTariffs = loadMissingTariffs();
    }

    public Tariff calculate(Tariff tariff) {
        var request = new PriceRequest();
        request.setWeight(tariff.getWeight().intValue());
        request.setCountryCodes(List.of(tariff.getCountry().getCode()));
        request.setShipmentType( tariff.getType() == DOCUMENT ? "letter" : "parcel");
        request.setWithContract(false);

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        var response = template.exchange(PRICES_BY_COUNTRY_URL, HttpMethod.POST, new HttpEntity<>(request, headers), PriceResponse.class).getBody();

        Tariff.Result result = null;
        tariff.setData(new Tariff.Input());
        tariff.getData().setModes(new ArrayList<>());


        if (response.getWorkFlows() != null) {
            var workflowList = response.getWorkFlows().stream().filter(e->e.getLabel().equals("parcel-economy-small")).toList();
            if (workflowList.size() == 1) {
                if (workflowList.get(0).getWeightCosts().size() == 1) {
                    result = new Tariff.Result();
                    result.setWeightTo(tariff.getWeight());
                    var price = workflowList.get(0).getWeightCosts().get(0).getPriceWithTax()
                        .divide(new BigDecimal("100"))
                        .setScale(2, RoundingMode.HALF_UP);

                    if (tariff.getMode() == Tariff.Mode.TRACEABLE) {
                        if (response.getWorkFlows().stream().filter(e->e.getLabel().equals("parcel-standard-small")).toList().size() == 1) {
                            if (response.getWorkFlows().stream().filter(e->e.getLabel().equals("parcel-standard-small")).toList().get(0).getAdditionalServiceCosts().stream().filter(e->e.getName().equals("trackingInternational")).toList().size() == 1) {
                                var mode = new Tariff.ModeInput();
                                tariff.getData().getModes().add(mode);
                                mode.setId(Tariff.Mode.TRACEABLE.getId());
                                price = price.add(new BigDecimal("2.54"));
                            } else {
                                price = BigDecimal.ZERO;
                            }
                        }else {
                            price = BigDecimal.ZERO;
                        }
                    }

                    tariff.setResult(result);
                    tariff.getResult().setAmount(price);
                }
            }
        }

        if (result == null) {
            var missingPrice = lookupMissingPrice(tariff);
            if (missingPrice != null) {
                result = new Tariff.Result();
                result.setWeightTo(tariff.getWeight());
                tariff.setResult(result);
                tariff.getResult().setAmount(missingPrice.price.setScale(2, RoundingMode.HALF_UP));

                if (tariff.getMode() == Tariff.Mode.TRACEABLE && missingPrice.traceable) {
                    var mode = new Tariff.ModeInput();
                    tariff.getData().getModes().add(mode);
                    mode.setId(Tariff.Mode.TRACEABLE.getId());

                    tariff.getResult().setAmount(tariff.getResult().getAmount().add(new BigDecimal("2.54")));
                }
            }
        }

        if (tariff.getCountry() == Tariff.Country.LATVIA) {
            tariff.getResult().setTrackable(new BigDecimal("1.40"));
        } else {
            tariff.getResult().setTrackable(new BigDecimal("2.54"));
        }

        tariff.setResult(result);
        return tariff;
    }

    record Missing (BigDecimal price, Boolean traceable){};
    private Missing lookupMissingPrice(Tariff tariff) {
        if (tariff.getCountry() == null || tariff.getWeight() == null) {
            return null;
        }
        var countryCode = tariff.getCountry().getCode();
        var weight = tariff.getWeight().intValue();

        var match = missingTariffs.stream()
            .filter(e -> e.getCountryCode().equalsIgnoreCase(countryCode))
            .findFirst()
            .orElse(null);
        if (match == null) {
            return null;
        }

        for (var band : match.getPriceBands()) {
            if (band.getWeightTo() == null) {
                if (weight >= band.getWeightFrom()) {
                    return new Missing(band.getPrice(), match.getTraceable());
                }
            } else if (weight >= band.getWeightFrom() && weight <= band.getWeightTo()) {
                return new Missing(band.getPrice(), match.getTraceable());
            }
        }
        return null;
    }

    private List<MissingTariff> loadMissingTariffs() {
        var mapper = new ObjectMapper();
        try (InputStream stream = getClass().getClassLoader().getResourceAsStream(MISSING_TARIFFS_RESOURCE)) {
            if (stream == null) {
                return List.of();
            }
            return mapper.readValue(stream, new TypeReference<List<MissingTariff>>() {});
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load missing tariffs from " + MISSING_TARIFFS_RESOURCE, e);
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PriceRequest {
        private String shipmentType;
        private List<String> countryCodes;
        private Integer weight;
        private Boolean withContract;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PriceResponse {
        @JsonProperty("@context")
        private String context;

        @JsonProperty("@id")
        private String id;

        @JsonProperty("@type")
        private String type;

        private List<WorkFlow> workFlows;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WorkFlow {
        @JsonProperty("@id")
        private String id;

        @JsonProperty("@type")
        private String type;

        private String shipmentSizeType;
        private List<AdditionalServiceCost> additionalServiceCosts;
        private List<WeightCost> weightCosts;
        private String label;
        private String countryCode;
        private List<String> serviceOptions;
        private String deliveryDays;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AdditionalServiceCost {
        @JsonProperty("@id")
        private String id;

        @JsonProperty("@type")
        private String type;

        private String name;
        private BigDecimal priceWithTax;
        private BigDecimal priceRatio;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WeightCost {
        @JsonProperty("@id")
        private String id;

        @JsonProperty("@type")
        private String type;

        private BigDecimal priceWithTax;
        private Boolean insurance;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MissingTariff {
        private String countryCode;
        private Boolean traceable;
        private List<MissingPriceBand> priceBands;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MissingPriceBand {
        private Integer weightFrom;
        private Integer weightTo;
        private BigDecimal price;
    }
}
