package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ToysPlanetScraper extends HtmlScraper {
    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://www.toysplanet.lv/lv/lego-un-konstruktori/konstruktori/tx-S802?page={page}&limit=24"))
            .page(1)
            .itemsCssQuery("div.category-product")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("h4.card-title").text() )
                    .price(parsePrice(element.selectFirst("div.price__primary").text()))
                    .link(element.selectFirst("a.card-link").attr("href"))
                    .image(element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.TOYS_PLANET;
    }
}
