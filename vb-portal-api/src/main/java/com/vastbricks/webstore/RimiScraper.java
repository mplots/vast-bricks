package com.vastbricks.webstore;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class RimiScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://www.rimi.lv/e-veikals/en/products/babies-and-children/toys/lego-construction-sets/c/SH-15-8-27?currentPage={page}&pageSize=80"))
            .page(1)
            .itemsCssQuery("li.product-grid__item")
            .headers(Map.of(
                HttpHeaders.USER_AGENT, "MyCustomUserAgent/1.0"
            ))
            .itemProcessor(element -> {
                var discounted = element.selectFirst("div.price-per-unit");
                var regular = element.selectFirst("p.card__price-per");
                if (!regular.text().contains("out of stock")) {
                    return WebSet.builder()
                        .name(element.selectFirst("p.card__name").text() )
                        .price(parsePrice((discounted!=null ? discounted.text() : regular.text()).replace(" €/pcs.", "")))
                        .link("https://www.rimi.lv" + element.selectFirst("a").attr("href"))
                        .image(element.selectFirst("img").attr("src").replace(",q_1,", ",q_100,"))
                    .build();
                } else {
                    return null;
                }
            })
        .build();
    }

    @Override
    public String getWebStore() {
        return "rimi.lv";
    }
}
