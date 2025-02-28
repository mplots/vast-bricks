package com.vastbricks.market.owl;

import com.google.common.util.concurrent.RateLimiter;
import lombok.AllArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;

@Slf4j
@AllArgsConstructor
public class OwlClient {
    private static final String BASE_URL = "https://api.brickowl.com";
    private String key;
    private static final RateLimiter rateLimiter = RateLimiter.create(1);

    @SneakyThrows
    public PartOutValue catalogPartOutValue(ItemType type, String id) {
        var boids = catalog().idLookup(type, id);
        var partOutValue = new PartOutValue();
        if (boids.size() == 1) {
            var item = catalog().lookup(boids.get(0));
            partOutValue.setCatNamePath(item.getCatNamePath());
            rateLimiter.acquire();
            Document inventory = Jsoup.connect(item.getUrl() + "/inventory").get();
            var partOutHtml = inventory.select("div.inv-warn").select("span.price");
            partOutValue.setBoid(id);

            if (partOutHtml.size() > 0) {
                partOutValue.setNewCost(new BigDecimal(partOutHtml.get(0).text().replace(",", "").replace("$", "")));
            } else {
                partOutValue.setNewCost(new BigDecimal(inventory.selectFirst("span.price").text().replace(",", "").replace("$", "")));
            }
            if (partOutHtml.size() > 1) {
                partOutValue.setUsedCost(new BigDecimal(partOutHtml.get(1).text().replace(",", "").replace("$", "")));
            }

            if (partOutHtml.size() > 2) {
                partOutValue.setNewSold(new BigDecimal(partOutHtml.get(2).text().replace(",", "").replace("$", "")));
            }
            if (partOutHtml.size() > 3) {
                partOutValue.setUsedSold(new BigDecimal(partOutHtml.get(3).text().replace(",", "").replace("$", "")));
            }
        }
        return partOutValue;
    }

    public String htmlInventory(String url) {
        rateLimiter.acquire();
        try {
            return new RestTemplate().getForObject(url, String.class);
        }catch (HttpClientErrorException.NotFound e) {
            log.warn("Not found: %s".formatted(url));
            return "";
        }
    }

    public WebScraper web() {
        return new WebScraper();
    }

    public CatalogAPI catalog() {
        return new CatalogAPI(BASE_URL, key);
    }

    private BigDecimal parsePrice(String price) {
        return StringUtils.isBlank(price) ?  null : new BigDecimal(price.replace(",", "").replace("$", ""));
    }
}
