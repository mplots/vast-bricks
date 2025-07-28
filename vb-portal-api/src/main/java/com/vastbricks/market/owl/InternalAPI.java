package com.vastbricks.market.owl;

import com.google.common.util.concurrent.RateLimiter;
import com.vastbricks.config.LoggingInterceptor;
import lombok.AllArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.regex.Pattern;

@Slf4j
@AllArgsConstructor
public class InternalAPI {

    private static final RateLimiter RATE_LIMITER = RateLimiter.create(1);
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\d+");

    private String cookie;
    private final RestTemplate template = new RestTemplate();

    private static final String BASE_URL = "https://www.brickowl.com";


    public Long createShippingMethod(ShippingMethodDetails shippingMethod) {
        var url = "%s/mystore/settings/shipping_methods/add".formatted(BASE_URL);

        var bottomForm = getBottomForm(url);

        // Allow multiple reads of the response body
        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));
        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        var ajaxHeaders = new HttpHeaders();
        ajaxHeaders.add(HttpHeaders.COOKIE, cookie);
        ajaxHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ajaxHeaders.add("x-requested-with", "XMLHttpRequest");

        RATE_LIMITER.acquire();
        var shipmentFormData = new LinkedMultiValueMap<String, Object>();
        shipmentFormData.add("main_prefill", "custom");
        shipmentFormData.add("bottom_form_id", bottomForm.id);
        shipmentFormData.add("bottom_form_token", bottomForm.token);
        shipmentFormData.add("_triggering_element_name", "main_prefill");
        shipmentFormData.add("_triggering_element_value", "custom");
        shipmentFormData.add("_ajax_submit", "true");
        template.exchange(url, HttpMethod.POST, new HttpEntity<>(shipmentFormData, ajaxHeaders), String.class);

        //Select pricing type
        RATE_LIMITER.acquire();
        var pricingTypeFormData = new LinkedMultiValueMap<String, Object>();
        pricingTypeFormData.add("main_type", "weight");
        pricingTypeFormData.add("bottom_form_id", bottomForm.id);
        pricingTypeFormData.add("bottom_form_token", bottomForm.token);
        pricingTypeFormData.add("_triggering_element_name", "main_type");
        pricingTypeFormData.add("_triggering_element_value", "weight");
        pricingTypeFormData.add("_ajax_submit", "true");
        template.exchange(url, HttpMethod.POST, new HttpEntity<>(pricingTypeFormData, ajaxHeaders), String.class);

        var formData = shippingFormData(url, shippingMethod, bottomForm);
        formData.add("bottom_op", "Create");

        var headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        RATE_LIMITER.acquire();
        template.exchange(url, HttpMethod.POST, new HttpEntity<>(formData, headers), Void.class);

        return listShippingMethods().stream()
                .filter(e -> e.getName().equals(shippingMethod.getName()))
                .max(Comparator.comparing(ShippingMethod::getUpdated))
                .map(ShippingMethod::getId)
                .orElse(null);
    }

    public Long updateShippingMethod(ShippingMethodDetails newMethod, boolean force) {

        var url = "%s/mystore/settings/shipping_methods/edit/%s".formatted(BASE_URL, newMethod.getId());
        var bottomForm = getBottomForm(url);

        var existingMethod = parseShippingForm(newMethod.getId(), bottomForm.html);
        if (force || !existingMethod.equals(newMethod)) { //TODO: Doesn't work when name is not equal
            // Allow multiple reads of the response body
            template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));
            // Add logging interceptor
            template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

            var formData = shippingFormData(url, newMethod, bottomForm);
            formData.add("bottom_op", "Update");

            var headers = new HttpHeaders();
            headers.add(HttpHeaders.COOKIE, cookie);
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            RATE_LIMITER.acquire();
            template.exchange(url, HttpMethod.POST, new HttpEntity<>(formData, headers), Void.class);
        }
        return newMethod.getId();
    }

    public ShippingMethodDetails getShippingMethod(Long id) {
        var url = "%s/mystore/settings/shipping_methods/edit/%s".formatted(BASE_URL, id);

        // Allow multiple reads of the response body
        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));
        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        RATE_LIMITER.acquire();
        var headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);

        var html = template.exchange(url, HttpMethod.GET, new HttpEntity<>(null, headers), String.class).getBody();
        var form = Jsoup.parse(html);

        return parseShippingForm(id, form);
    }

    public List<ShippingMethod> listShippingMethods() {
        var url = "%s/mystore/settings/shipping_methods?display_disabled=1".formatted(BASE_URL);
        RATE_LIMITER.acquire();

        var result = new ArrayList<ShippingMethod>();
        var headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);
        var html = template.exchange(url, HttpMethod.GET, new HttpEntity(null, headers), String.class).getBody();
        var shippingMethods = Jsoup.parse(html);
        var carrierIdPattern = Pattern.compile("carrier_(\\d+)");
        var deleteTokenPattern = Pattern.compile(".*/(\\w+\\?.*)");

        for(var row : shippingMethods.selectXpath("//table[@class and contains(@class, 'data-table')]//tbody//tr")) {
            var td = row.select("td");
            var method = td.get(0);
            var carrier = td.get(1);
            var updated = td.get(2);
            var enabled = td.get(3);
            var delete = td.get(4);
            var carrierIdMatcher = carrierIdPattern.matcher(carrier.select("img").attr("src"));
            var deleteTokenMatcher = deleteTokenPattern.matcher(delete.select("a").attr("href"));

            result.add(
                ShippingMethod.builder()
                   .id(Long.valueOf(method.select("a").attr("href").replace("/mystore/settings/shipping_methods/edit/", "")))
                   .name(method.text())
                   .carrierId(carrierIdMatcher.find() ? Long.valueOf(carrierIdMatcher.group(1)) : null)
                   .carrierName(carrier.text())
                   .updated(LocalDateTime.ofEpochSecond(Long.valueOf(updated.select("span").text()), 0, ZonedDateTime.now(ZoneId.systemDefault()).getOffset()))
                   .enabled("Enabled".equals(enabled.text()))
                   .deleteToken(deleteTokenMatcher.find() ? deleteTokenMatcher.group(1) : null)
                .build()
            );
        }

        return result;
    }



    @SneakyThrows
    public void deleteShippingMethod(String ...names) {
        // Allow multiple reads of the response body
        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));
        // Add logging interceptor
        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));

        var allUrl = "%s/mystore/settings/shipping_methods".formatted(BASE_URL);
        RATE_LIMITER.acquire();
        var headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);

        var html = template.exchange(allUrl, HttpMethod.GET, new HttpEntity(null, headers), String.class).getBody();
        var shippingMethods = Jsoup.parse(html);
        for (var name : names) {
            var href = shippingMethods.selectXpath("//tr[td/a[contains(text(), '" + name +"')]]//a[@class and contains(@class, 'btn')]").attr("href");
            if (!StringUtils.isBlank(href)) {
                var deleteUrl = "%s%s" .formatted(BASE_URL, href);
                RATE_LIMITER.acquire();
                template.exchange(deleteUrl, HttpMethod.GET, new HttpEntity(null, headers), Void.class);
            }
        }
    }

    public WebSetInventory webSetInventory(String url) {
        return parseWebSetInventory(rawWebSetInventory(url));
    }

    public WebSetInventory parseWebSetInventory(String html) {
        if (html == null) {
            return new WebSetInventory();
        }
        var inventory = Jsoup.parse(html);

        var invWarn = inventory.selectFirst("div.inv-warn").text();
        var title = inventory.selectFirst("h1.title").text();

        var webSetInventory = new WebSetInventory();
        var numberMatcher = NUMBER_PATTERN.matcher(title);

        var link = inventory.selectXpath("//link[@hreflang='en']").stream().findFirst();
        if (link.isPresent()) {
            webSetInventory.setLink(link.get().attr("href"));
        }

        webSetInventory.setNumber(numberMatcher.find() ? Long.valueOf(numberMatcher.group()) : null);
        webSetInventory.setTitle(title);

        parsePartOutValue("current cost of the parts in new condition is",
                invWarn, webSetInventory::setCurrentPriceNew, webSetInventory::setCurrentPercentageNew);
        parsePartOutValue("cost of the parts in used condition is",
                invWarn, webSetInventory::setCurrentPriceUsed, webSetInventory::setCurrentPercentageUsed);
        parsePartOutValue("In the past, in new condition, the parts have sold for",
                invWarn, webSetInventory::setPastPriceNew, webSetInventory::setPastPercentageNew);
        parsePartOutValue("In used condition they have sold for",
                invWarn, webSetInventory::setPastPriceUsed, webSetInventory::setPastPercentageUsed);

        return webSetInventory;
    }

    public String rawWebSetInventory(String url) {
        RATE_LIMITER.acquire();
        try {
            return new RestTemplate().getForObject(url, String.class);
        }catch (HttpClientErrorException.NotFound e) {
            log.warn("Not found: %s".formatted(url), e);
            return null;
        }
    }

    private void parsePartOutValue(String prefix, String text, Consumer<BigDecimal> priceSetter, Consumer<Integer> percentageSetter) {
        var matcher = Pattern.compile(prefix + " \\$(\\d+\\.\\d{2})(?: \\((\\d+)% of items\\))?").matcher(text);
        if (matcher.find()) {
            var price = matcher.group(1);
            var percentage = matcher.group(2);
            priceSetter.accept(StringUtils.isBlank(price) ?  null : new BigDecimal(price.replace(",", "")));
            percentageSetter.accept(StringUtils.isBlank(percentage) ?  null : Integer.valueOf(percentage));
        }
    }

    private record BottomForm(Document html, String id, String token, Integer pricingSize){}
    //bottom_form_id & bottom_form_token required to perform for form post
    private BottomForm getBottomForm(String url) {
        RATE_LIMITER.acquire();
        var headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);

        var html = template.exchange(url, HttpMethod.GET, new HttpEntity<>(null, headers), String.class).getBody();
        var form = Jsoup.parse(html);
        var bottomFormId = form.selectXpath("//input[@name='bottom_form_id']").attr("value");
        var bottomFormToken = form.selectXpath("//input[@name='bottom_form_token']").attr("value");
        var size = form.select("table.ship-method-table").select("tbody").select("tr").size();

        return new BottomForm(form, bottomFormId, bottomFormToken, size);
    }

    private ShippingMethodDetails parseShippingForm(Long id, Document form) {
        var carrier = form.selectXpath("//select[@name='main_carrier_id']//option[@selected]");
        var enabled = form.selectXpath("//input[@name='main_enabled']");
        var name = form.selectXpath("//input[@name='main_ship_method_name']");
        var share = form.selectXpath("//input[@name='advanced_share']");
        var expedited = form.selectXpath("//input[@name='advanced_is_expedited']");
        var requirePhone = form.selectXpath("//input[@name='require_phone']");
        var dontDefault = form.selectXpath("//input[@name='advanced_dont_default']");
        var minPriceLimit = form.selectXpath("//input[@name='advanced_min_price_limit']");
        var maxPriceLimit = form.selectXpath("//input[@name='advanced_max_price_limit']");
        var volume = form.selectXpath("//input[@name='advanced_volume']");
        var totalDimensions = form.selectXpath("//input[@name='advanced_total_dimensions']");
        var note = form.selectXpath("//input[@name='advanced_note']");
        var length = form.selectXpath("//input[@name='restrictions_dimensions_length']");
        var width = form.selectXpath("//input[@name='restrictions_dimensions_width']");
        var height = form.selectXpath("//input[@name='restrictions_dimensions_height']");
        var countries = form.selectXpath("//select[@name='restrictions_countries[]']//option[@selected]");
        var initialWeightFrom = form.selectXpath("//input[@name='bands_table_0_band_from_0']");
        var pricing = form.select("table.ship-method-table").select("tbody").select("tr");

        return ShippingMethodDetails.builder()
            .id(id)
            .carrierId(longValue(carrier.attr("value")))
            .carrierName(carrier.text())
            .enabled(boolValue(enabled.attr("checked")))
            .name(name.attr("value"))
            .share(boolValue(share.attr("checked")))
            .expedited(boolValue(expedited.attr("checked")))
            .requirePhone(boolValue(requirePhone.attr("checked")))
            .dontDefault(boolValue(dontDefault.attr("checked")))
            .minPriceLimit(bigDecimalValue(minPriceLimit.attr("value")))
            .maxPriceLimit(bigDecimalValue(maxPriceLimit.attr("value")))
            .volume(bigDecimalValue(volume.attr("value")))
            .totalDimensions(bigDecimalValue(totalDimensions.attr("value")))
            .restrictions(
                ShipmentDimensions.builder()
                    .length(bigDecimalValue(length.attr("length")))
                    .width(bigDecimalValue(width.attr("value")))
                    .height(bigDecimalValue(height.attr("height")))
                .build()
            )
            .countries(
                countries.stream()
                .map(e -> Arrays.stream(Country.values())
                        .filter(c -> c.getCode().equals(e.attr("value")))
                        .findFirst()
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList()
            )
            .note(note.text())
            .initialWeightFrom(bigDecimalValue(initialWeightFrom.attr("value")))
            .pricing(
                pricing.stream().map(e->
                    ShipmentPricing.builder()
                        .weightTo(bigDecimalValue(e.select("input").get(1).attr("value")))
                        .price(bigDecimalValue(e.select("input").get(2).attr("value")))
                    .build()
                ).filter(e->e.getPrice()!=null && e.getWeightTo()!=null).toList()
            )
        .build();
    }


    private LinkedMultiValueMap shippingFormData(String  url, ShippingMethodDetails shippingMethod, BottomForm bottomForm) {
        var ajaxHeaders = new HttpHeaders();
        ajaxHeaders.add(HttpHeaders.COOKIE, cookie);
        ajaxHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        ajaxHeaders.add("x-requested-with", "XMLHttpRequest");

        var formData = new LinkedMultiValueMap<String, Object>();
        formData.add("bottom_form_id", bottomForm.id);
        formData.add("bottom_form_token", bottomForm.token);

        formData.add("main_carrier_id", shippingMethod.getCarrierId());
        formData.add("main_ship_method_name", shippingMethod.getName());
        formData.add("main_enabled", shippingMethod.getEnabled() ? "1" : "0");
        formData.add("advanced_min_price_limit", "");
        formData.add("advanced_max_price_limit", "");
        formData.add("advanced_volume", "");
        formData.add("advanced_total_dimensions", "");
        formData.add("advanced_note", shippingMethod.getNote());
        formData.add("restrictions_dimensions_length", "");
        formData.add("restrictions_dimensions_width", "");
        formData.add("restrictions_dimensions_height", "");
        formData.add("restrictions_region_chooser", "");


        if(CollectionUtils.isNotEmpty(shippingMethod.getPricing())) {
            for (var country : shippingMethod.getCountries()) {
                formData.add("restrictions_countries[]", country.getCode());
            }
        }

        if(CollectionUtils.isNotEmpty(shippingMethod.getPricing())) {
            formData.add("bands_table_0_band_from_0", shippingMethod.getInitialWeightFrom());
            for(var i = 0; i<shippingMethod.getPricing().size(); i++) {
                var pricing = shippingMethod.getPricing().get(i);
                formData.add("bands_table_%s_band_to_0".formatted(i), pricing.getWeightTo());
                formData.add("bands_table_%s_price_0".formatted(i), pricing.getPrice());

                if (bottomForm.pricingSize - 1 < i) {
                    var addFormData = new LinkedMultiValueMap<>(formData);
                    addFormData.add("_triggering_element_name", "bands_table_%s_add_0" .formatted(i));
                    addFormData.add("_triggering_element_value", "Add / Update Row");
                    addFormData.add("_ajax_submit", "true");
                    RATE_LIMITER.acquire();
                    template.exchange(url, HttpMethod.POST, new HttpEntity<>(addFormData, ajaxHeaders), String.class);
                }
            }
            formData.add("bands_table_%s_band_to_0".formatted(shippingMethod.getPricing().size()), "");
            formData.add("bands_table_%s_price_0".formatted(shippingMethod.getPricing().size()), "");
        }

        formData.add("band_adjust_mass_increase_percent", "");
        formData.add("band_adjust_mass_increase_amount", "");

        return formData;
    }

    private Long longValue(String value) {
        return StringUtils.isNotBlank(value) ? Long.valueOf(value) : null;
    }

    private BigDecimal bigDecimalValue(String value) {
        return StringUtils.isNotBlank(value) ? new BigDecimal(value).setScale(2, RoundingMode.HALF_UP) : null;
    }

    private Boolean boolValue(String value) {
        return "checked".equals(value);
    }
}
