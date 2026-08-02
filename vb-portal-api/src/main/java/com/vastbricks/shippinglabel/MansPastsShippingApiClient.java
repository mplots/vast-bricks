package com.vastbricks.shippinglabel;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import lombok.Data;
import lombok.RequiredArgsConstructor;
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

import java.net.URI;
import java.util.Arrays;
import java.util.List;

@Component
@RequiredArgsConstructor
class MansPastsShippingApiClient {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Env env;
    private final RestTemplate template = createRestTemplate();

    MansPastsShippingLabel createPackageAndDownloadDocument(MansPastsPackageRequest request) {
        validateCredentials();

        var packageResponse = createPackage(request);
        var documentLink = createDocument(packageResponse.packageId);
        return new MansPastsShippingLabel(
                downloadPdf(documentLink),
                packageResponse.packageId,
                packageResponse.firstBarcode()
        );
    }

    private PackageCreateResponse createPackage(MansPastsPackageRequest request) {
        var envelope = new PackageCreateEnvelope(PackageCreateRequest.from(apiUser(), apiKey(), request));
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            var response = template.exchange(
                    baseUrl() + "/api/packages",
                    HttpMethod.POST,
                    new HttpEntity<>(envelope, headers),
                    PackageCreateResponse.class
            );
            var body = response.getBody();
            if (body == null || StringUtils.isBlank(body.packageId)) {
                throw new MansPastsShippingApiException("Mans Pasts package response did not include packageId");
            }
            return body;
        } catch (HttpStatusCodeException ex) {
            throw toApiException("Mans Pasts package creation failed. Request: " + sanitized(envelope), ex);
        } catch (RestClientException ex) {
            throw new MansPastsShippingApiException("Mans Pasts package creation failed", ex);
        }
    }

    private String createDocument(String packageId) {
        var envelope = new DocumentEnvelope(new DocumentRequest(apiUser(), apiKey(), packageId, "Accompanying documents"));
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            var response = template.exchange(
                    baseUrl() + "/api/documents",
                    HttpMethod.POST,
                    new HttpEntity<>(envelope, headers),
                    DocumentResponse.class
            );
            var body = response.getBody();
            if (body == null || StringUtils.isBlank(body.link)) {
                throw new MansPastsShippingApiException("Mans Pasts document response did not include download link");
            }
            return body.link;
        } catch (HttpStatusCodeException ex) {
            throw toApiException("Mans Pasts document creation failed", ex);
        } catch (RestClientException ex) {
            throw new MansPastsShippingApiException("Mans Pasts document creation failed", ex);
        }
    }

    private byte[] downloadPdf(String link) {
        try {
            var response = template.exchange(resolveLink(link), HttpMethod.GET, HttpEntity.EMPTY, byte[].class);
            var body = response.getBody();
            if (body == null || body.length == 0) {
                throw new MansPastsShippingApiException("Mans Pasts returned an empty PDF");
            }
            return body;
        } catch (HttpStatusCodeException ex) {
            throw toApiException("Mans Pasts PDF download failed", ex);
        } catch (RestClientException ex) {
            throw new MansPastsShippingApiException("Mans Pasts PDF download failed", ex);
        }
    }

    private String resolveLink(String link) {
        var uri = URI.create(link);
        if (uri.isAbsolute()) {
            return link;
        }
        return baseUrl() + (link.startsWith("/") ? link : "/" + link);
    }

    private void validateCredentials() {
        if (StringUtils.isBlank(apiUser()) || StringUtils.isBlank(apiKey())) {
            throw new MansPastsShippingApiException("Mans Pasts API credentials are not configured");
        }
    }

    private String apiUser() {
        return StringUtils.trimToNull(env.getMansPastsApiUser());
    }

    private String apiKey() {
        return StringUtils.trimToNull(env.getMansPastsApiKey());
    }

    private String baseUrl() {
        return StringUtils.removeEnd(StringUtils.defaultIfBlank(env.getMansPastsApiBaseUrl(), "https://www.manspasts.lv"), "/");
    }

    private MansPastsShippingApiException toApiException(String prefix, HttpStatusCodeException ex) {
        var body = StringUtils.abbreviate(StringUtils.trimToEmpty(ex.getResponseBodyAsString()), 500);
        var message = StringUtils.isBlank(body) ? prefix : prefix + ": " + body;
        return new MansPastsShippingApiException(ex.getStatusCode(), message);
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

    private static RestTemplate createRestTemplate() {
        var restTemplate = new RestTemplate();
        restTemplate.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));

        var jsonConverter = new MappingJackson2HttpMessageConverter();
        jsonConverter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.TEXT_HTML));
        restTemplate.getMessageConverters().add(jsonConverter);
        return restTemplate;
    }

    private record PackageCreateEnvelope(@JsonProperty("package_create") PackageCreateRequest packageCreate) {
    }

    private record DocumentEnvelope(@JsonProperty("document") DocumentRequest document) {
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private static class PackageCreateRequest {
        private String user;

        @JsonProperty("api_key")
        private String apiKey;

        private String type;
        private String postageType;
        private String itemType;
        private String comment;
        private List<PackageAddress> addresses;

        private static PackageCreateRequest from(String apiUser, String apiKey, MansPastsPackageRequest source) {
            var request = new PackageCreateRequest();
            request.setUser(apiUser);
            request.setApiKey(apiKey);
            request.setType(source.type());
            request.setPostageType(source.postageType());
            request.setItemType(source.itemType());
            request.setComment(source.comment());
            request.setAddresses(List.of(PackageAddress.from(source)));
            return request;
        }
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private static class PackageAddress {
        private String countryCode;
        private String freeformAddressLine1;
        private String freeformAddressLine2;
        private String postCode;
        private String name;
        private String phone;
        private String email;
        private java.math.BigDecimal userPackageWeight;

        private static PackageAddress from(MansPastsPackageRequest source) {
            var address = new PackageAddress();
            address.setCountryCode(source.countryCode());
            address.setFreeformAddressLine1(source.freeformAddressLine1());
            address.setFreeformAddressLine2(source.freeformAddressLine2());
            address.setPostCode(source.postCode());
            address.setName(source.name());
            address.setPhone(source.phone());
            address.setEmail(source.email());
            address.setUserPackageWeight(source.userPackageWeight());
            return address;
        }
    }

    private record DocumentRequest(
            String user,
            @JsonProperty("api_key") String apiKey,
            @JsonProperty("package") String packageId,
            String documentType
    ) {
    }

    @Data
    private static class PackageCreateResponse {
        private String packageId;
        private List<String> barcodes;
        private Integer code;
        private String message;

        private String firstBarcode() {
            return barcodes == null || barcodes.isEmpty() ? null : barcodes.get(0);
        }
    }

    @Data
    private static class DocumentResponse {
        private Integer code;
        private String message;
        private String link;
    }
}
