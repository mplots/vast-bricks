package com.vastbricks.webstore;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@Slf4j
public class XSScraper implements Scraper {

    @Data
    private static final class XSRoot {
        private XSData data;
    }

    @Data
    private static final class XSData {
        private XSProducts products;
    }

    @Data
    private static final class XSProducts {
        @JsonProperty("total_count")
        private Long totalCount;
        private List<XSProduct> items;
        @JsonProperty("page_info")
        private XSPageInfo pageInfo;
    }

    @Data
    private static final class XSPageInfo {
        @JsonProperty("total_pages")
        private Long totalPages;
    }

    @Data
    private static final class XSProduct {
        private String name;
        @JsonProperty("stock_status")
        private String stockStatus;
        @JsonProperty("price_range")
        private XSPriceRange priceRange;

        @JsonProperty("small_image")
        private XSImage smallImage;

        private String url;

    }

    @Data
    private static final class XSPriceRange {
        @JsonProperty("minimum_price")
        private XSMinimumPrice minimumPrice;
    }

    @Data
    private static final class XSMinimumPrice {
        @JsonProperty("registered_user_price")
        private XSPrice registeredUserPrice;
    }


    @Data
    private static final class XSPrice {
        private BigDecimal value;
    }

    @Data
    private static final class XSImage {
        private String url;
    }

    @Override
    public List<WebSet> scrape() {
        var restTemplate = new RestTemplate();
        var url = "https://www.xsrotallietas.lv/lv_LV/graphql?hash={hash}&_sort_0={sort}&_filter_0={filter}&_pageSize_0={size}&_currentPage_0={page}&v={v}";
        var page = 1;
        var result = new ArrayList<WebSet>();
        XSRoot root;
        do {
            log.info("Scrapping %s Page: %s".formatted(getWebStore(), (page)));

            root = restTemplate.getForEntity(url, XSRoot.class,
                Map.of(
                    "hash", "1735195887",
                    "sort", "{created_at:DESC}",
                    "filter", "{category_url_path:{eq:rotallietas/konstruktori/legossss},customer_group_id:{eq:0}}",
                    "size", "100",
                    "page", page,
                    "v", "2"
                )
            ).getBody();

            result.addAll(root.getData().getProducts().getItems().stream().map(i->{
                    var matcher = ID_PATTERN.matcher(i.name);
                    return !matcher.find() || !i.getStockStatus().equals("IN_STOCK") ? null :
                      WebSet.builder()
                        .store(getWebStore())
                        .price(i.getPriceRange().getMinimumPrice().getRegisteredUserPrice().getValue())
                        .image(i.getSmallImage().getUrl())
                        .name(i.getName())
                        .number(Long.valueOf(matcher.group()))
                        .link(i.getUrl())
                    .build();
                }
            ).filter(Objects::nonNull).toList());
            page++;
        } while (page <= root.getData().getProducts().getPageInfo().getTotalPages());

        return result;
    }

    @Override
    public String getWebStore() {
        return "xsrotallietas.lv";
    }
}
