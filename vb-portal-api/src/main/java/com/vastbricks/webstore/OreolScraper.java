package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class OreolScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://oreol.eu/tovary-dlya-detej/lego/?limit=100&page={page}"))
            .page(1)
            .itemsCssQuery("div.product-grid")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("img").attr("title"))
                    .price(parsePrice(element.selectFirst("p.price").text()))
                    .link(element.selectFirst("a").attr("href"))
                    .image(element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.OREOL;
    }
}
