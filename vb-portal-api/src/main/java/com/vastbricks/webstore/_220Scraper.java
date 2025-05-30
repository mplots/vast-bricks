package com.vastbricks.webstore;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.jpa.entity.WebStore;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
@Slf4j
public class _220Scraper extends HtmlScraper {


    @Data
    private static final class Root {
        private String photoUrl;
        private String title;
        private String url;
        private DataLayerItem dataLayerItem;
    }

    @Data
    private static final class DataLayerItem {
        @JsonProperty("item_status")
        private String itemStatus;

        private BigDecimal price;
    }


    @Override
    protected ScraperArgs scraperArgs() {
        var mapper = new ObjectMapper();
        mapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        return ScraperArgs.builder()
            .urls(List.of("https://220.lv/lv/rotallietas-un-preces-berniem/rotallietas-un-speles/konstruktori/f/lego?page={page}"))
            .page(1)
            .itemsCssQuery("div.c-product-card")
            .userAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36")
            .itemProcessor(element -> {
                try {
                    var json = element.attr("widget-data");
                    var root = mapper.readValue(json, Root.class);

                    return !"active".equals(root.getDataLayerItem().itemStatus) ? null :
                    WebSet.builder()
                            .name(root.title)
                            .price(root.dataLayerItem.price)
                            .link(root.url)
                            .image(root.photoUrl.replace("xsmall", "large"))
                    .build();
                } catch (Exception e) {
                    log.warn(e.getMessage(), e);
                }
                return null;
            })
        .build();
    }

    @Override
    public WebStore getWebStore() {
        return WebStore._220;
    }
}
