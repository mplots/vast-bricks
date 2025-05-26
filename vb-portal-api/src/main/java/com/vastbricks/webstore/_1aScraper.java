package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class _1aScraper extends HtmlScraper {
    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://www.1a.lv/c/berniem-mazuliem/lego-rotallietas-un-lelles/lego/37h?page_per=72&page={page}"))
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
    public WebStore getWebStore() {
        return WebStore._1A;
    }
}
