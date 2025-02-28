package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;


@Component
public class DigimartScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
          return ScraperArgs.builder()
            .url("https://digimart.lv/lego-c/lego-c/lego-c?limit=100&page={page}")
            .page(1)
            .itemsCssQuery("div.product-link-2")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("span.product-link-2-title").text())
                    .price(parsePrice(element.selectFirst("span.product-link-2-prices").text()))
                    .link(element.selectFirst("a").attr("href"))
                    .image(element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.DIGIMART;
    }
}
