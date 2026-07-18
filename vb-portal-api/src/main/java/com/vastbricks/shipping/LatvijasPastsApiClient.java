package com.vastbricks.shipping;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@NoArgsConstructor
@AllArgsConstructor
public class LatvijasPastsApiClient {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String SOURCE = "vast-bricks";
    private static final String VERSION = "1.0";
    private static final String CONTENT_NAME = "Lego Set";
    private static final String HS_CODE = "950300";
    private static final String CONTENT_ORIGIN_COUNTRY = "DK";
    private static final List<Integer> WEIGHT_LIMITS = List.of(
            20, 100, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000,
            8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000,
            16000, 17000, 18000, 19000, 20000, 21000, 22000, 23000,
            24000, 25000, 26000, 27000, 28000, 29000, 30000
    );

    private  RestTemplate template;
    private  String apiUser;
    private  String apiKey;
    private  String baseUrl;

    public LatvijasPastsApiClient(Env env) {
        this(env.getMansPastsApiUser(), env.getMansPastsApiKey(), env.getMansPastsApiBaseUrl(), createRestTemplate());
    }

    LatvijasPastsApiClient(String apiUser, String apiKey, String baseUrl, RestTemplate template) {
        this.apiUser = StringUtils.trimToNull(apiUser);
        this.apiKey = StringUtils.trimToNull(apiKey);
        this.baseUrl = StringUtils.removeEnd(StringUtils.defaultIfBlank(baseUrl, "https://www.manspasts.lv"), "/");
        this.template = template;
    }

    public ShippingLabelResult createSmallPackageLabel(Order order) {
        validateCredentials();
        validateOrder(order);

        var packageResponse = createPackage(order);
        var documentLink = findAddressLabelLink(packageResponse);
        if (StringUtils.isBlank(documentLink)) {
            documentLink = createAddressLabelDocument(packageResponse);
        }

        return new ShippingLabelResult(
                downloadPdf(documentLink),
                packageResponse.getPackageId(),
                firstBarcode(packageResponse)
        );
    }

    private PackageCreateResponse createPackage(Order order) {
        var request = PackageCreateRequest.from(apiUser, apiKey, order);
        var envelope = new PackageCreateEnvelope(request);
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            var response = template.exchange(
                    baseUrl + "/api/packages",
                    HttpMethod.POST,
                    new HttpEntity<>(envelope, headers),
                    PackageCreateResponse.class
            );
            var body = response.getBody();
            if (body == null || body.getPackageId() == null) {
                throw new LatvijasPastsApiException("Mans Pasts package response did not include packageId");
            }
            return body;
        } catch (HttpStatusCodeException ex) {
            throw toApiException("Mans Pasts package creation failed. Request: " + sanitized(envelope), ex);
        } catch (RestClientException ex) {
            throw new LatvijasPastsApiException("Mans Pasts package creation failed", ex);
        }
    }

    private String createAddressLabelDocument(PackageCreateResponse packageResponse) {
        var documentRequest = new DocumentRequest();
        documentRequest.setUser(apiUser);
        documentRequest.setApiKey(apiKey);
        documentRequest.setPackageId(packageResponse.getPackageId().toString());
        documentRequest.setDocumentType("Address labels");
        documentRequest.setDocumentPrintType("A4");

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            var response = template.exchange(
                    baseUrl + "/api/documents",
                    HttpMethod.POST,
                    new HttpEntity<>(new DocumentEnvelope(documentRequest), headers),
                    DocumentResponse.class
            );
            var body = response.getBody();
            if (body == null || StringUtils.isBlank(body.getLink())) {
                throw new LatvijasPastsApiException("Mans Pasts document response did not include download link");
            }
            return body.getLink();
        } catch (HttpStatusCodeException ex) {
            throw toApiException("Mans Pasts document creation failed", ex);
        } catch (RestClientException ex) {
            throw new LatvijasPastsApiException("Mans Pasts document creation failed", ex);
        }
    }

    private byte[] downloadPdf(String link) {
        if (StringUtils.isBlank(link)) {
            throw new LatvijasPastsApiException("Mans Pasts document download link is missing");
        }
        try {
            var response = template.exchange(resolveLink(link), HttpMethod.GET, HttpEntity.EMPTY, byte[].class);
            var body = response.getBody();
            if (body == null || body.length == 0) {
                throw new LatvijasPastsApiException("Mans Pasts returned an empty PDF");
            }
            return body;
        } catch (HttpStatusCodeException ex) {
            throw toApiException("Mans Pasts PDF download failed", ex);
        } catch (RestClientException ex) {
            throw new LatvijasPastsApiException("Mans Pasts PDF download failed", ex);
        }
    }

    private String resolveLink(String link) {
        var uri = URI.create(link);
        if (uri.isAbsolute()) {
            return link;
        }
        return baseUrl + (link.startsWith("/") ? link : "/" + link);
    }

    private String findAddressLabelLink(PackageCreateResponse response) {
        if (response.getDocuments() == null) {
            return null;
        }
        return response.getDocuments().stream()
                .map(this::documentLinkIfAddressLabel)
                .filter(StringUtils::isNotBlank)
                .findFirst()
                .orElseGet(() -> response.getDocuments().stream()
                        .map(this::documentLink)
                        .filter(StringUtils::isNotBlank)
                        .findFirst()
                        .orElse(null));
    }

    private String documentLinkIfAddressLabel(Object document) {
        if (!(document instanceof Map<?, ?> map)) {
            return null;
        }
        var label = firstString(map, "documentType", "type", "name", "title");
        if (label == null || !label.toLowerCase().contains("address")) {
            return null;
        }
        return documentLink(document);
    }

    private String documentLink(Object document) {
        if (document instanceof String value) {
            return value;
        }
        if (document instanceof Map<?, ?> map) {
            return firstString(map, "link", "url", "href", "downloadLink");
        }
        return null;
    }

    private String firstString(Map<?, ?> map, String... keys) {
        for (var key : keys) {
            var value = map.get(key);
            if (value != null) {
                return value.toString();
            }
        }
        return null;
    }

    private String firstBarcode(PackageCreateResponse response) {
        if (response.getAddressBarcodes() == null || response.getAddressBarcodes().isEmpty()) {
            return null;
        }
        return response.getAddressBarcodes().get(0);
    }

    private void validateCredentials() {
        if (StringUtils.isBlank(apiUser) || StringUtils.isBlank(apiKey)) {
            throw new LatvijasPastsApiException("Mans Pasts API credentials are not configured");
        }
    }

    private void validateOrder(Order order) {
        if (order == null) {
            throw new LatvijasPastsApiException("Shipping order is required");
        }
        if (StringUtils.isBlank(order.getFullName())) {
            throw new LatvijasPastsApiException("Recipient name is required");
        }
        if (StringUtils.isBlank(order.getCountry())) {
            throw new LatvijasPastsApiException("Recipient country is required");
        }
        if (StringUtils.isBlank(order.getAddress1())) {
            throw new LatvijasPastsApiException("Recipient address is required");
        }
        if (StringUtils.isBlank(order.getPostcode())) {
            throw new LatvijasPastsApiException("Recipient postal code is required");
        }
        if (order.getWeight() == null || order.getWeight().compareTo(BigDecimal.ZERO) <= 0) {
            throw new LatvijasPastsApiException("Package weight is required");
        }
    }

    private LatvijasPastsApiException toApiException(String prefix, HttpStatusCodeException ex) {
        var body = StringUtils.abbreviate(StringUtils.trimToEmpty(ex.getResponseBodyAsString()), 500);
        var message = StringUtils.isBlank(body) ? prefix : prefix + ": " + body;
        return new LatvijasPastsApiException(ex.getStatusCode(), message);
    }

    private String sanitized(Object payload) {
        try {
            var node = MAPPER.valueToTree(payload);
            var root = node.path("package_create");
            if (root.isObject()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) root).put("api_key", "***");
            }
            return StringUtils.abbreviate(MAPPER.writeValueAsString(node), 1000);
        } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException ex) {
            return "<unavailable>";
        }
    }

    static RestTemplate createRestTemplate() {
        var restTemplate = new RestTemplate();
        restTemplate.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));

        var jsonConverter = new MappingJackson2HttpMessageConverter();
        jsonConverter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.TEXT_HTML));
        restTemplate.getMessageConverters().add(jsonConverter);
        return restTemplate;
    }

    public record ShippingLabelResult(byte[] pdf, Integer packageId, String barcode) {
    }

    private record PackageCreateEnvelope(@JsonProperty("package_create") PackageCreateRequest packageCreate) {
    }

    private record DocumentEnvelope(@JsonProperty("document") DocumentRequest document) {
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    static class PackageCreateRequest {
        private String user;

        @JsonProperty("api_key")
        private String apiKey;

        private String source;
        private String version;
        private List<PackageAddress> addresses;
        private String type;
        private String weightTo;
        private String postageType;
        private String itemType;
        private Boolean apiz;

        private static PackageCreateRequest from(String apiUser, String apiKey, Order order) {
            var request = new PackageCreateRequest();
            request.setUser(apiUser);
            request.setApiKey(apiKey);
            request.setAddresses(List.of(PackageAddress.from(order)));
            request.setType(packageType(order.getType()));
            request.setPostageType(order.getMode() == Tariff.Mode.TRACEABLE ? "Tracked" : "Ordinary");
            request.setItemType(itemType(order.getType()));
            if (isDomestic(order)) {
                request.setApiz(true);
            }
            return request;
        }
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    static class PackageAddress {
        private Integer sequenceNumber;
        private String countryCode;
        private String freeformAddressLine1;
        private String freeformAddressLine2;
        private String postCode;
        private String name;
        private String phone;
        private String email;
        private String contentType;
        private BigDecimal userPackageWeight;
        private List<ContentItem> contentItems;
        private Boolean commercial;

        private static PackageAddress from(Order order) {
            var address = new PackageAddress();
            address.setCountryCode(order.getCountry());
            address.setFreeformAddressLine1(StringUtils.trimToEmpty(order.getAddress1()));
            address.setFreeformAddressLine2(StringUtils.trimToEmpty(order.getAddress2()));
            address.setPostCode(order.getPostcode());
            address.setName(order.getFullName());
            address.setPhone(StringUtils.trimToNull(order.getTelephone()));
            address.setEmail(StringUtils.trimToNull(order.getEmail()));
            address.setUserPackageWeight(scaleWeight(order.getWeight()));
//            if (!"LV".equalsIgnoreCase(order.getCountry())) {
//                address.setContentType("Other");
//                address.setContentItems(List.of(ContentItem.from(order)));
//                address.setCommercial(true);
//            }
            return address;
        }
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    static class ContentItem {
        private String name;
        private String quantity;
        private BigDecimal weight;
        private BigDecimal value;
        private String hsCode;
        private String country;

        private static ContentItem from(Order order) {
            var content = new ContentItem();
            content.setName(CONTENT_NAME);
            content.setQuantity(Objects.toString(order.getQuantity() == null ? 1 : order.getQuantity()));
            content.setWeight(scaleWeight(order.getWeight()));
            content.setValue(order.getPackValue() == null ? new BigDecimal("0.01") : order.getPackValue().setScale(2, RoundingMode.HALF_UP));
            content.setHsCode(HS_CODE);
            content.setCountry(CONTENT_ORIGIN_COUNTRY);
            return content;
        }
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private static class DocumentRequest {
        private String user;

        @JsonProperty("api_key")
        private String apiKey;

        @JsonProperty("package")
        private String packageId;

        private String documentType;
        private String documentPrintType;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class PackageCreateResponse {
        private Integer code;
        private String message;
        private Integer packageId;
        private List<String> addressBarcodes;
        private List<Object> documents;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    static class DocumentResponse {
        private Integer code;
        private String message;
        private String link;
    }

    private static Integer weightLimit(BigDecimal weight) {
        var grams = scaleWeight(weight).intValue();
        return WEIGHT_LIMITS.stream()
                .filter(limit -> grams <= limit)
                .findFirst()
                .orElse(30000);
    }

    private static BigDecimal scaleWeight(BigDecimal weight) {
        return weight.setScale(0, RoundingMode.CEILING);
    }

    private static String packageType(Tariff.Type type) {
        return "goods";
    }

    private static String itemType(Tariff.Type type) {
        return type == Tariff.Type.DOCUMENT ? "Letter" : "Parcel";
    }

    private static boolean isDomestic(Order order) {
        return "LV".equalsIgnoreCase(order.getCountry());
    }
}
