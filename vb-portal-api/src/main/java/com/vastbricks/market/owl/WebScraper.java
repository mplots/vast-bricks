package com.vastbricks.market.owl;

import com.google.common.util.concurrent.RateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.function.Consumer;
import java.util.regex.Pattern;

@Slf4j
public class WebScraper {

    private static final RateLimiter RATE_LIMITER = RateLimiter.create(1);
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\d+");

    public WebSetInventory webSetInventory(String url) {
        return parseWebSetInventory(rawWebSetInventory(url));
    }

    public WebSetInventory parseWebSetInventory(String html) {
        if (html == null) {
            return new WebSetInventory();
        }
        var inventory = Jsoup.parse(html);

        var invWarn = inventory.selectFirst("div.inv-warn").text();
        var title = inventory.selectFirst("h1.title").text();

        var webSetInventory = new WebSetInventory();
        var numberMatcher = NUMBER_PATTERN.matcher(title);

        var link = inventory.selectXpath("//link[@hreflang='en']").stream().findFirst();
        if (link.isPresent()) {
            webSetInventory.setLink(link.get().attr("href"));
        }

        webSetInventory.setNumber(numberMatcher.find() ? Long.valueOf(numberMatcher.group()) : null);
        webSetInventory.setTitle(title);

        parsePartOutValue("current cost of the parts in new condition is",
                invWarn, webSetInventory::setCurrentPriceNew, webSetInventory::setCurrentPercentageNew);
        parsePartOutValue("cost of the parts in used condition is",
                invWarn, webSetInventory::setCurrentPriceUsed, webSetInventory::setCurrentPercentageUsed);
        parsePartOutValue("In the past, in new condition, the parts have sold for",
                invWarn, webSetInventory::setPastPriceNew, webSetInventory::setPastPercentageNew);
        parsePartOutValue("In used condition they have sold for",
                invWarn, webSetInventory::setPastPriceUsed, webSetInventory::setPastPercentageUsed);

        return webSetInventory;
    }

    public String rawWebSetInventory(String url) {
        RATE_LIMITER.acquire();
        try {
            return new RestTemplate().getForObject(url, String.class);
        }catch (HttpClientErrorException.NotFound e) {
            log.warn("Not found: %s".formatted(url), e);
            return null;
        }
    }

    private void parsePartOutValue(String prefix, String text, Consumer<BigDecimal> priceSetter, Consumer<Integer> percentageSetter) {
        var matcher = Pattern.compile(prefix + " \\$(\\d+\\.\\d{2})(?: \\((\\d+)% of items\\))?").matcher(text);
        if (matcher.find()) {
            var price = matcher.group(1);
            var percentage = matcher.group(2);
            priceSetter.accept(StringUtils.isBlank(price) ?  null : new BigDecimal(price.replace(",", "")));
            percentageSetter.accept(StringUtils.isBlank(percentage) ?  null : Integer.valueOf(percentage));
        }
    }
}
