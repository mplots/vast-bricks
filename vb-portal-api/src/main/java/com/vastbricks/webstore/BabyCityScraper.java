package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class BabyCityScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://www.babycity.lv/lv/lego-un-konstruktori/tx-S8?taxonCode%5B0%5D=2539%7CS801%7C2%7C2641&limit=24&page={page}"))
            .page(1)
            .itemsCssQuery("div.product-box")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("h4.card-title").text())
                    .price(parsePrice(element.selectFirst("div.price__primary").text()))
                    .link(element.selectFirst("a.card-link").attr("href"))
                    .image(element.selectFirst("div.image-slider") != null ? element.selectFirst("div.image-slider").selectFirst("img").attr("src") : element.selectFirst("a.card-link").selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }
    @Override
    public WebStore getWebStore() {
        return WebStore.BABY_CITY;
    }
}
