package com.vastbricks.shipping;

import com.vastbricks.config.LoggingInterceptor;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.HttpCookie;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.NoSuchElementException;

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
        formData.add("lp_tariffs_modes", tariff.getMode() != null ? tariff.getMode().getId() : "");
        formData.add("lp_tariffs_weight", tariff.getWeight() !=null ? tariff.getWeight() : "");
        formData.add("lp_tariffs_mp", tariff.isMansPasts() ? "checked" : "");
        formData.add("lp_tariffs_ins", tariff.getInsuredAmount() != null ? tariff.getInsuredAmount() : "");

        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.add("x-requested-with", "XMLHttpRequest");

        return template.exchange(url, HttpMethod.POST, new HttpEntity(formData, headers), Tariff.class).getBody();
    }

    public String login(String username, String password) {
        var url = "https://www.manspasts.lv/lv/login";
        var formData = new LinkedMultiValueMap<String, Object>();
        formData.add("_username", username);
        formData.add("_password", password);

        var headers = new HttpHeaders();
        headers.set("Accept", "*/*");
        headers.set("User-Agent", "User-Agent: curl/8.7.1");
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        var response = template.exchange(url, HttpMethod.POST, new HttpEntity<>(formData, headers), String.class);
        return parsePHPSESSID(response.getHeaders().get("Set-Cookie"));
    }

    public byte[] createOrder(Order order) {
        var location = postNewOrderType(order);
        var nextStepToken = addAddress(location, order);
        addShipmentInformation(location, nextStepToken, order);
        sendInformationOverEmail(location, order);
        return downloadForms(location, order);
    }


    private String postNewOrderType(Order order) {
        var url = "https://www.manspasts.lv/lv/order/new-order";
        var orderTokenBody = template.exchange(url, HttpMethod.GET, new HttpEntity<>(new HttpHeaders(){{set("Cookie", order.getCookie());}}), String.class).getBody();
        var token = Jsoup.parse(orderTokenBody).selectFirst("#order_type_form__token").val();

        var headers = new HttpHeaders();
        headers.set("Cookie", order.getCookie());
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        var formData = new LinkedMultiValueMap<String, Object>();
        formData.add("order_type_form[shipmentName]", order.getType().getCode());
        formData.add("order_type_form[shipmentType]", order.getMode().getCode());
        formData.add("order_type_form[_token]", token);
        return template.exchange(url, HttpMethod.POST, new HttpEntity<>(formData, headers), Void.class).getHeaders().get("Location").get(0);
    }

    private String addAddress(String location, Order order) {
        var url = "https://www.manspasts.lv" + location;

        var form = template.exchange(url, HttpMethod.GET, new HttpEntity<>(new HttpHeaders(){{set("Cookie", order.getCookie());}}), String.class).getBody();
        var token = Jsoup.parse(form).selectFirst("#order_registered_recipient_form__token").val();

        var headers = new HttpHeaders();
        headers.set("Cookie", order.getCookie());
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        headers.set("X-Requested-With", "XMLHttpRequest");
        headers.set("addaddress", "true");
        headers.set("reload-form", "true");
        headers.set("reload-element", "undefined");

        var formData = new LinkedMultiValueMap<String, Object>();
        formData.add("order_registered_recipient_form[type]", "1");
        formData.add("order_registered_recipient_form[userInfo][fullName]", order.getFullName());
        formData.add("order_registered_recipient_form[userInfo][company]", "");
        formData.add("order_registered_recipient_form[userInfo][telephone]", StringUtils.defaultIfBlank(order.getTelephone(), ""));
        formData.add("order_registered_recipient_form[userInfo][email]", StringUtils.defaultIfBlank(order.getEmail(), ""));
        formData.add("order_registered_recipient_form[newAddress][type]", "1");
        formData.add("order_registered_recipient_form[newAddress][simpleAddress][country]", order.getCountry());
        formData.add("order_registered_recipient_form[newAddress][simpleAddress][address1]", order.getAddress1());
        formData.add("order_registered_recipient_form[newAddress][simpleAddress][address2]", order.getAddress2());
        formData.add("order_registered_recipient_form[newAddress][simpleAddress][postcode]", order.getPostcode());
        if (order.getCountry().equals("US")) {
            formData.add("order_registered_recipient_form[newAddress][simpleAddress][region]", order.getState());
        }
        formData.add("order_registered_recipient_form[_token]", token);
        template.exchange(url, HttpMethod.POST, new HttpEntity<>(formData, headers), Void.class);

        return Jsoup.parse(form).selectFirst("#next_step__token").val();
    }

    private void addShipmentInformation(String location, String nextStepToken, Order order) {
        var url = "https://www.manspasts.lv" + location;

        var headers = new HttpHeaders();
        headers.set("Cookie", order.getCookie());
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        var nextStepFormData = new LinkedMultiValueMap<String, Object>();
        nextStepFormData.add("next_step[_token]", nextStepToken);

        template.exchange(url, HttpMethod.POST, new HttpEntity<>(nextStepFormData, headers), String.class).getBody();
        var form = Jsoup.parse(template.exchange(url, HttpMethod.GET, new HttpEntity<>(new HttpHeaders(){{set("Cookie", order.getCookie());}}), String.class).getBody());
        var token = form.selectFirst("#order_packages__token").val();

        var requiresPackageContent = form.select("#package-contents-input-block-0 .row").size() > 0;
        var formData = new LinkedMultiValueMap<String, Object>();
        var weight = order.getWeight().divide(new BigDecimal("1000"), 3, RoundingMode.HALF_UP);

        formData.add("order_packages[packageEnterType]", "1");
        formData.add("order_packages[orderRecipients][0][userPackageWeight]", weight);
        formData.add("order_packages[orderRecipients][0][postPay]", "");
        formData.add("order_packages[orderRecipients][0][notes]", "");
        formData.add("order_packages[orderRecipients][0][packageClass]", "A");
        formData.add("order_packages[orderRecipients][0][payerPerson]", "");
        formData.add("order_packages[orderRecipients][0][payerBankCode]", "");
        formData.add("query", "");
        formData.add("order_packages[_token]", token);

        if (requiresPackageContent) {
            formData.add("order_packages[orderRecipients][0][packageType]", "31");
            formData.add("order_packages[orderRecipients][0][packages][0][contentName]", "Lego Parts");
            formData.add("order_packages[orderRecipients][0][packages][0][quantity]", order.getQuantity());
            formData.add("order_packages[orderRecipients][0][packages][0][weight]", weight);
            formData.add("order_packages[orderRecipients][0][packages][0][packValue]", order.getPackValue());
            formData.add("order_packages[orderRecipients][0][packages][0][hsCodeText]", "950300");
            formData.add("order_packages[orderRecipients][0][packages][0][hsCode]", "6211");
            formData.add("order_packages[orderRecipients][0][packages][0][countryCode]", "DK");
            formData.add("order_packages[orderRecipients][0][customIndication]", "");
            formData.add("order_packages[orderRecipients][0][importerDetails]", "");
            formData.add("order_packages[orderRecipients][0][postagePaid]", "");
            formData.add("order_packages[orderRecipients][0][relatedDocuments]", "");
            formData.add("order_packages[orderRecipients][0][docDescription]", "");
            formData.add("order_packages[orderRecipients][0][docNumber]", "");
        }else {
            formData.add("order_registered_recipient_form[_token]", token);
        }

        template.exchange(url, HttpMethod.POST, new HttpEntity<>(formData, headers), String.class).getBody();
    }

    private void sendInformationOverEmail(String location, Order order) {
        var components =  location.split("\\/");
        var code = components[components.length - 1];
        template.exchange("https://www.manspasts.lv/lv/order/email_barcode/" + code, HttpMethod.GET, new HttpEntity<>(new HttpHeaders(){{set("Cookie", order.getCookie());}}), String.class).getBody();
    }

    private byte[] downloadForms(String location, Order order) {
        var components =  location.split("\\/");
        var code = components[components.length - 1];

        var headers = new HttpHeaders();
        headers.set("Cookie", order.getCookie());

        return template.exchange("https://www.manspasts.lv/en/orders/createPDF/" + code +"/forms", HttpMethod.POST, new HttpEntity<>(headers), byte[].class).getBody();
    }

    private String parsePHPSESSID(List<String> cookiesHeaders) {
        for (var cookiesHeader : cookiesHeaders) {
            return HttpCookie.parse(cookiesHeader).stream()
                    .filter(cookie -> "PHPSESSID".equals(cookie.getName()))
                    .map(e->"PHPSESSID=" + e.getValue() + ";")
                    .findFirst().get();
        }
        throw new NoSuchElementException("No value present");
    }

}
