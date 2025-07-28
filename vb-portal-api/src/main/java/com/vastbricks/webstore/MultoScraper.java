package com.vastbricks.webstore;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class MultoScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://multo.eu/lego-klucisi.515.g?i=all"))
            .itemsCssQuery("div.-product")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("a.-title").text() )
                    .price(parsePrice(element.selectFirst("div.-price_box").text()))
                    .link("https://multo.eu" + element.selectFirst("a").attr("href"))
                    .image("https://multo.eu" + element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public String getWebStore() {
        return "multo.eu";
    }
}
