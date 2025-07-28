package com.vastbricks.webstore;

import lombok.Data;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

@Component
@Slf4j
public class BerniemScraper implements Scraper {

    @Data
    public static final class Products {
        private String products;
    }


    @Override
    @SneakyThrows
    public List<WebSet> scrape() {
        var restTemplate = new RestTemplate();
        var result = new ArrayList<WebSet>();
        var categories = List.of(
            "lego-adults",
            "lego-animal-crossing",
            "lego-architecture",
            "lego-avatar",
            "lego-batman",
            "lego-boost",
            "lego-city",
            "lego-classic",
            "lego-creator",
            "lego-disney",
            "lego-dreamzzz",
            "lego-dots",
            "lego-friends",
            "lego-gabbys-dollhouse",
            "lego-harry-potter",
            "lego-hidden-side",
            "lego-icons",
            "lego-ideas",
            "lego-indiana-jones",
            "lego-ipasa-kolekcija",
            "lego-jurassic-world",
            "lego-key-chains",
            "lego-lightyear",
            "lego-super-heroes",
            "lego-mindstorms",
            "lego-minecraft",
            "lego-minifigures",
            "lego-minions",
            "lego-movie",
            "lego-ninjago",
            "lego-lego-sonic-the-hedgehog",
            "lego-speed-champions",
            "lego-spider-man",
            "lego-star-wars",
            "lego-super-mario",
            "lego-technic",
            "lego-trolls",
            "lego-toy-story",
            "lego-vidiyo",
            "lego-wednesday",
            "lego-wicked",
            "lego-botanical",
            "citi-lego"
        );

        for (var category : categories) {
            var page = 1;
            var hasMorePages = true;
            do {
                var url = "https://berniem.eu/filter";

                var formData = new LinkedMultiValueMap<String, String>();
                var headers = new HttpHeaders();
                headers.add("content-type", "application/x-www-form-urlencoded; charset=UTF-8");
                headers.add("x-requested-with", "XMLHttpRequest");

                formData.add("filters", "{}");
                formData.add("values", "[]");
                formData.add("fields", "[]");
                formData.add("range_filter", "[]");
                formData.add("categories", "[]");
                formData.add("current_url", "https://berniem.eu/lv/" + category);
                formData.add("sort", "");
                formData.add("main", "");
                formData.add("base_url", "https://berniem.eu/lv/" + category);
                formData.add("current_category", category);
                formData.add("page", String.valueOf(page));

                // Build the request
                var request = new HttpEntity<>(formData, headers);

                log.info("Scrapping %s Page: %s Category: %s".formatted(getWebStore(), page, category));

                var response = restTemplate.postForEntity(url, request, Products.class);

                var doc = Jsoup.parse(response.getBody().getProducts());

                var items = doc.select("div.product");
                if (items.isEmpty()) {
                    hasMorePages = false;
                } else {
                    for (var item : items) {
                        try {
                            var specialPrice = item.selectFirst("span.special-price");
                            var gSpecialPrice = item.selectFirst("span.g-special-price");
                            var webSet = WebSet.builder()
                                .image("https://berniem.eu" + item.selectFirst("img").attr("src"))
                                .name(item.selectFirst("div.catalog-product-description").text())
                                .price(HtmlScraper.parsePrice(gSpecialPrice !=null ? gSpecialPrice.text() : specialPrice.text()))
                                .link("https://berniem.eu" + item.selectFirst("a").attr("href"))
                            .build();
                            var name = webSet.getName();
                            var matcher = ID_PATTERN.matcher(name);
                            if (matcher.find() && name.toLowerCase().contains("lego") && !name.toLowerCase().contains("duplo") ) {
                                webSet.setNumber(Long.valueOf(matcher.group()));
                                webSet.setStore(getWebStore());
                                result.add(webSet);
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                    page++;
                }
            } while (hasMorePages);

        }
        return result;
    }

    @Override
    public String getWebStore() {
        return "berniem.eu";
    }
}
