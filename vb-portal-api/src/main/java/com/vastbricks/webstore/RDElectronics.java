package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import org.springframework.stereotype.Component;

import java.util.List;

//@Component
public class RDElectronics extends HtmlScraper {
    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(List.of("https://www.rdveikals.lv/categories/lv/1674/sort/5/filter/0_0_0_0/page/{page}/LEGO.html"))
            .page(1)
            .itemsCssQuery("li.product")
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("h3.product__title").text() )
                    .price(parsePrice(element.selectFirst("p.price").text()))
                    .link("https://www.rdveikals.lv/" + element.selectFirst("a").attr("href"))
                    .image("https://www.rdveikals.lv/" + element.selectFirst("img").attr("src"))
                .build()
            )
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.RD_ELECTRONIC;
    }
}
