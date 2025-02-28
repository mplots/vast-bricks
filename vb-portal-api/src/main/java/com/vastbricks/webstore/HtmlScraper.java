package com.vastbricks.webstore;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.vastbricks.jpa.entity.WebStore;
import lombok.Builder;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
public abstract class HtmlScraper implements Scraper {

    @Builder
    static final class ScraperArgs {
        private String url;
        private Integer page;
        private String itemsCssQuery;
        private ItemProcessor itemProcessor;
    }

    interface ItemProcessor {
        WebSet process(Element element);
    }

    @Override
    public List<WebSet> scrape() {
        var template = new RestTemplate();
        var result = new ArrayList<WebSet>();
        var args = scraperArgs();
        var page = args.page;

        var hasMorePages = true;

        while (hasMorePages) {
            hasMorePages = page != null;
            try {
                log.info("Scrapping %s Page: %s".formatted(getWebStore(), (page)));
                var html = template.getForEntity(args.url, String.class, page !=null ?Map.of("page", page) : Map.of()).getBody();
                var doc = Jsoup.parse(html);
                var items = doc.select(args.itemsCssQuery);
                if (items.isEmpty()) {
                    hasMorePages = false;
                } else {
                    for (var item : items) {
                        try {
                            var webSet = args.itemProcessor.process(item);
                            if (webSet == null) {
                                hasMorePages = false;
                                break;
                            }
                            var name = webSet.getName();
                            var matcher = ID_PATTERN.matcher(name);
                            if (matcher.find() && name.toLowerCase().contains("lego") && !name.toLowerCase().contains("duplo") ) {
                                webSet.setNumber(Long.valueOf(matcher.group()));
                                webSet.setStore(getWebStore());
                                result.add(webSet);
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                    if (page != null) {
                        page++;
                    }
                }
            } catch (Exception e) {
                log.error("Error fetching page " + page + ": " + e.getMessage());
                hasMorePages = false;
            }
        }
        return result;
    }

    protected BigDecimal parsePrice(String price) {
        if (StringUtils.isBlank(price)) {
            return null;
        }
        if (price.contains(",") && price.contains(".")) {
            price = price.replace(",", "");
        }
        return new BigDecimal(price.replace(" ", "").replace(",", ".").replace("€", ""));
    }

    protected abstract ScraperArgs scraperArgs();
}
