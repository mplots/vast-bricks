package com.vastbricks.webstore;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.jpa.entity.WebStore;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Component
@Slf4j
public class BarboraScraper implements Scraper {

    @Data
    private static final class BarboraProduct {
        private String  title;
        private BigDecimal price;
        private String image;
        @JsonProperty("Url")
        private String url;
    }

    @Override
    public List<WebSet> scrape() {
        var result = new ArrayList<WebSet>();
        var page = 0;
        var store = getWebStore();
        var url = "https://www.barbora.lv/zidainu-un-bernu-preces/lego-konstruktori?page={page}";
        var hasMorePages = true;

        var objectMapper = new ObjectMapper();
        objectMapper.disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        while (hasMorePages) {
            try {
                log.info("Scrapping %s Page: %s".formatted(store, (page)));

                var doc = Jsoup.connect(UriComponentsBuilder.fromUriString(url).buildAndExpand(page).toUriString()).get();

                var productScript = doc.select("script").stream().filter(e->e.html().contains("window.b_productList")).findFirst();
                if (!productScript.isPresent()) {
                    hasMorePages = false;
                } else {
                    var productJson = productScript.get().html().replace("window.b_productList = ", "").replace(";", "");
                    var productList = objectMapper.readValue(productJson, new TypeReference<List<BarboraProduct>>() {});
                    if (productList.size() >0) {
                        result.addAll(productList.stream().map(e ->{
                            var matcher = ID_PATTERN.matcher(e.title);
                            return !matcher.find() ? null :
                            WebSet.builder()
                                .name(e.title)
                                .price(e.price)
                                .image(e.image)
                                .store(WebStore.BARBORA)
                                .link("https://www.barbora.lv/produkti/" + e.url)
                                .number(Long.valueOf(matcher.group()))
                            .build();
                    }).filter(Objects::nonNull).toList());
                    }else {
                        hasMorePages = false;
                    }
                }
                page++;
            } catch (IOException e) {
                log.error("Error fetching page " + page + ": " + e.getMessage(), e);
                hasMorePages = false;
            }
        }
        return result;
    }

    @Override
    public WebStore getWebStore() {
        return WebStore.BARBORA;
    }
}
