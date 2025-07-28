package com.vastbricks.webstore;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class LabsVeikalsScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
         return ScraperArgs.builder()
            .urls(List.of("https://labsveikals.lv/lv/products?m=3295"))
            .itemsCssQuery("div.p")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("div.pn").text())
                    .price(parsePrice(element.selectFirst("span.ui-money-amount").text()))
                    .link(element.selectFirst("a").attr("href"))
                    .image("https://labsveikals.lv/" + element.selectFirst("div.pi").selectFirst("img").attr("data-src"))
                .build()
            )
        .build();
    }

    @Override
    public String  getWebStore() {
        return "labsveikals.lv";
    }
}
