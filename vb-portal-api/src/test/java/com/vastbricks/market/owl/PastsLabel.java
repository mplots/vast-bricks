package com.vastbricks.market.owl;

import com.vastbricks.config.LoggingInterceptor;
import com.vastbricks.market.link.PrivateAPI;
import com.vastbricks.shipping.LatvijasPastsClient;
import com.vastbricks.shipping.Order;
import com.vastbricks.shipping.Tariff;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Disabled
@Slf4j
class PastsLabel {

    @Test
    void createLabel() {
        var order = new PrivateAPI(System.getenv("TEST_BRICKLINK_CONSUMER_KEY"), System.getenv("TEST_BRICKLINK_CONSUMER_SECRET"), System.getenv("TEST_BRICKLINK_TOKEN"), System.getenv("TEST_BRICKLINK_TOKEN_SECTET"))
                .getOrder(28745081l);

        var address = order.getData().getShipping().getAddress();

        var username = System.getenv("TEST_PASTS_USERNAME");
        var password = System.getenv("TEST_PASTS_PASSWORD");

        var client = new LatvijasPastsClient();

        var cookie = client.login(username, password);
        client.createOrder(
            Order.builder()
                .cookie(cookie)
                .type(Tariff.Type.SMALL_PACKAGE)
                .mode(Tariff.Mode.SIMPLE)
                .fullName(address.getName().getFull())
                .telephone(address.getPhoneNumber())
                .email(order.getData().getBuyerEmail())
                .address1(join(address.getAddress1(), address.getAddress2()))
                .address2(join(address.getState(), address.getCity()))
                .country(order.getData().getShipping().getAddress().getCountryCode())
                .postcode(order.getData().getShipping().getAddress().getPostalCode())
                .weight(new BigDecimal("100"))

            .build()
        );
    }

    private String join(String ... strings) {
        return StringUtils.join(Arrays.stream(strings).filter(StringUtils::isNotBlank).toArray(), ", ");
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
