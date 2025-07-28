package com.vastbricks.webstore;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DateksScraper extends HtmlScraper{
    @Override
    protected ScraperArgs scraperArgs() {
         return ScraperArgs.builder()
            .urls(List.of("https://www.dateks.lv/cenas/lego/pg/{page}"))
            .page(0)
            .itemsCssQuery("div.prod")
            .documentProcessor(((document, page) -> page < document.selectXpath("//div[@class=\"list\"]/a").size()))
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("div.name").text() + " " + element.selectFirst("div.code").text().replace("Preces kods: ", "") )
                    .price(parsePrice(element.selectFirst("div.price").text()))
                    .link("https://www.dateks.lv" + element.selectFirst("a.imp").attr("href"))
                    .image("https://www.dateks.lv" + element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public String getWebStore() {
        return "dateks.lv";
    }
}
