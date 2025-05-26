package com.vastbricks.shipping;

import com.vastbricks.config.LoggingInterceptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.Collections;

public class LatvijasPastsClient {

    private final RestTemplate template = new RestTemplate();

    public LatvijasPastsClient() {
        // Allow multiple reads of the response body
        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));

        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        var jsonConverter = new MappingJackson2HttpMessageConverter();
        jsonConverter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.TEXT_HTML));
        template.getMessageConverters().add(jsonConverter);
    }

    public Tariff calculate(Tariff tariff) {
        var url = "https://ws.pasts.lv/lpTariffs/ajaxCall2020";

        var formData = new LinkedMultiValueMap<String, Object>();
        formData.add("lp_tariffs", "lp_tariffs_calculate");
        formData.add("lp_tariffs_types", tariff.getType().getId());
        formData.add("lp_tariffs_groups", tariff.getGroup().getId());
        formData.add("lp_tariffs_countries", tariff.getCountry().getId());
        formData.add("lp_tariffs_modes", tariff.getMode().getId());
        formData.add("lp_tariffs_weight", tariff.getWeight());
        formData.add("lp_tariffs_mp", tariff.isMansPasts() ? "checked" : "");
        formData.add("lp_tariffs_ins", tariff.getInsuredAmount() != null ? tariff.getInsuredAmount() : "");

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.add("x-requested-with", "XMLHttpRequest");

        return template.exchange(url, HttpMethod.POST, new HttpEntity(formData, headers), Tariff.class).getBody();
    }

}
