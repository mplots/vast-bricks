package com.vastbricks.webstore;


import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

@Component
public class M79Scraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .url("https://m79.lv/rotallietasspeles/lego/{page}")
            .page(1)
            .itemsCssQuery("div.item")
            .itemProcessor(element ->
                element.selectFirst("h3") == null ? null :
                WebSet.builder()
                    .name(element.selectFirst("h3").text())
                    .price(parsePrice(element.selectFirst("div.price").selectFirst("b").text()))
                    .link(element.selectFirst("h3").selectFirst("a").attr("href"))
                    .image(element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.M79;
    }
}
