package com.vastbricks.market.owl;

import com.vastbricks.config.LoggingInterceptor;
import com.vastbricks.shipping.LatvijasPastsClient;
import com.vastbricks.shipping.Order;
import com.vastbricks.shipping.Tariff;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.Collections;

@Disabled
@Slf4j
class PastsLabel {

    @Test
    void createLabel() {
        var username = System.getenv("TEST_PASTS_USERNAME");
        var password = System.getenv("TEST_PASTS_PASSWORD");

        var client = new LatvijasPastsClient();

        var cookie = client.login(username, password);
        client.createOrder(
            Order.builder()
                .cookie(cookie)
                .type(Tariff.Type.SMALL_PACKAGE)
                .mode(Tariff.Mode.SIMPLE)
            .build()
        );

    }

    private RestTemplate getRestTemplate() {
        var template = new RestTemplate();
        // Allow multiple reads of the response body
        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));

        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        var jsonConverter = new MappingJackson2HttpMessageConverter();
        jsonConverter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.TEXT_HTML));
        template.getMessageConverters().add(jsonConverter);
        return template;
    }
}
