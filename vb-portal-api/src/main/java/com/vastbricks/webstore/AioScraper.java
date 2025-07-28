package com.vastbricks.webstore;


import java.util.List;


public class AioScraper extends HtmlScraper {

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://aio.lv/lv/category--kubi-bloki-lego--331?manufacturer-id=1022&category-id=331&page={page}"))
            .page(1)
            .itemsCssQuery("div.list-product-mobile-wrapper")
            .itemProcessor(element -> {
                var specialPrice = element.selectFirst("div.special");
                var price = element.selectFirst("div.price");
                return WebSet.builder()
                    .name(element.selectFirst("a.title").text() )
                    .price(parsePrice(specialPrice != null ? specialPrice.text() : price.text()))
                    .link("https://aio.lv" + element.selectFirst("a").attr("href"))
                    .image("https://aio.lv" + element.selectFirst("img").attr("src"))
                .build();
                }
            )
        .build();
    }

    @Override
    public String getWebStore() {
        return "aio.lv";
    }
}
