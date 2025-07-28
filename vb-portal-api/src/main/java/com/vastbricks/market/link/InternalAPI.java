package com.vastbricks.market.link;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.LoggingInterceptor;
import jakarta.persistence.criteria.CriteriaBuilder;
import lombok.AllArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;


@Slf4j
@AllArgsConstructor
public class InternalAPI {

    private String cookie;

    private final RestTemplate template = new RestTemplate();
    private static final String BASE_URL = "https://www.bricklink.com";

    public ShippingMethod getShippingMethod(Integer id) {
        var url = "%s/ajax/renovate/mystore/shipping_method.ajax?action=get&id=%s".formatted(BASE_URL, id);
        var ajaxHeaders = new HttpHeaders();
        ajaxHeaders.add("x-requested-with", "XMLHttpRequest");
        ajaxHeaders.add(HttpHeaders.COOKIE, cookie);
        return template.exchange(url, HttpMethod.GET, new HttpEntity<>(ajaxHeaders), ShippingMethod.class).getBody();
    }

    public Countries getCountries() {
        var url = "%s/ajax/renovate/mystore/country_list.ajax".formatted(BASE_URL);
        var ajaxHeaders = new HttpHeaders();
        ajaxHeaders.add("x-requested-with", "XMLHttpRequest");
        return template.getForObject(url, Countries.class);
    }

    @SneakyThrows
    public ShippingMethod updateShippingMethod(Integer id, ShippingMethod shippingMethod) {

        var url = "%s/ajax/renovate/mystore/shipping_method.ajax".formatted(BASE_URL);
        var ajaxHeaders = new HttpHeaders();
        ajaxHeaders.add("x-requested-with", "XMLHttpRequest");
        ajaxHeaders.add(HttpHeaders.COOKIE, cookie);
        ajaxHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        var objectMapper = new ObjectMapper();
        objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        var body = objectMapper.writeValueAsString(shippingMethod.getMethod());

        var shipmentFormData = new LinkedMultiValueMap<String, Object>();
        shipmentFormData.add("id", id);
        shipmentFormData.add("unitType", 0);
        shipmentFormData.add("action", "update");
        shipmentFormData.add("method", body);
        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        return template.exchange(url, HttpMethod.POST, new HttpEntity<>(shipmentFormData, ajaxHeaders), ShippingMethod.class).getBody();
    }
}
