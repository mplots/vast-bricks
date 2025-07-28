package com.vastbricks.webstore;

import org.springframework.http.HttpHeaders;

import java.util.List;
import java.util.Map;

public class _1aScraper extends HtmlScraper {
    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://www.1a.lv/c/berniem-mazuliem/lego-rotallietas-un-lelles/lego/37h?page_per=72&page={page}"))
            .headers(Map.of(
                HttpHeaders.USER_AGENT, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
            ))
            .page(0)
            .itemsCssQuery("div.catalog-taxons-product")
            .itemProcessor(element ->
                element.selectFirst("p.catalog-taxons-product__out-of-stock") != null ? null :
                WebSet.builder()
                    .name(element.selectFirst("div.gtm-categories").attr("data-name"))
                    .price(parsePrice(element.selectFirst("div.gtm-categories").attr("data-price")))
                    .link("https://www.1a.lv" + element.selectFirst("a.catalog-taxons-product__image-anchor").attr("href"))
                    .image(element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public String  getWebStore() {
        return "1a.lv";
    }
}
