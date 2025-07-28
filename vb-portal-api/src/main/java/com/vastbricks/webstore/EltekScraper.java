package com.vastbricks.webstore;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class EltekScraper extends HtmlScraper {


    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://eltek.lv/lego.990.g?i=all"))
            .itemsCssQuery("div.-product")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("a.-title").text() )
                    .price(parsePrice(element.selectFirst("div.-price").text()))
                    .link("https://eltek.lv" + element.selectFirst("a").attr("href"))
                    .image("https://eltek.lv" + element.selectFirst("img").attr("img"))
                .build()
            )
        .build();
    }

    @Override
    public String getWebStore() {
        return "eltek.lv";
    }
}
