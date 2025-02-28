package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

@Component
public class MaxtradeScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .url("https://maxtrade.lv/lego.922.g?i=all&p={page}")
            .page(0)
            .itemsCssQuery("div.-product")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("a.-title").text())
                    .price(parsePrice(element.selectFirst("div.-price").text()))
                    .link("https://maxtrade.lv" + element.selectFirst("a.-title").attr("href"))
                    .image("https://maxtrade.lv" + element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.MAXTRADE;
    }
}
