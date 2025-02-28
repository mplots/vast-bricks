package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

@Component
public class Ksenukai extends HtmlScraper {

   @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .url("https://www.ksenukai.lv/c/rotallietas-preces-berniem/rotallietas-berniem/konstruktori/f/lego/dgo?page_per=72&page={page}")
            .page(0)
            .itemsCssQuery("div.catalog-taxons-product")
            .itemProcessor(element ->
                element.selectFirst("p.catalog-taxons-product__out-of-stock") != null ? null :
                WebSet.builder()
                    .name(element.selectFirst("div.gtm-categories").attr("data-name"))
                    .price(parsePrice(element.selectFirst("div.gtm-categories").attr("data-price")))
                    .link("https://www.ksenukai.lv" + element.selectFirst("a.catalog-taxons-product__image-anchor").attr("href"))
                    .image(element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.KSENUKAI;
    }
}
