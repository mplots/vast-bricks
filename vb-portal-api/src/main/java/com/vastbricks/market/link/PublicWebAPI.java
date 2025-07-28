package com.vastbricks.market.link;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Slf4j
public class PublicWebAPI {
    private static final String BASE_URL = "https://bricklink.com";
    private BigDecimal currencyRate = new BigDecimal("0.88");

    private static TorRestTemplate template = new TorRestTemplate();

    public PartOutValue partOutValue(String set) {
        var url = "%s/catalogPOV.asp?itemType=S&itemNo=%s&itemSeq=1&itemQty=1&bl=M&itemCondition=N&incInstr=Y&incParts=Y".formatted(BASE_URL, set);
        var headers = new HttpHeaders();
        log.info("Fetching BrickLink Part Out: %s".formatted(url));
        var response = template.exchange(url, HttpMethod.GET, new HttpEntity<>(null, headers), String.class);
        if (response == null) {
            return null;
        }
        var form = Jsoup.parse(response.getBody());
        var priceString = form.selectXpath("//tr[3]/td[1]//font[2]").text();
        if (StringUtils.isBlank(priceString)) {
            log.warn("Part out value for set '%s' not found".formatted(set));
            return null;
        } else {
            var last6monthsSalesAvg =  parsePrice(form.selectXpath("//tr[3]/td[1]//font[2]").text());
            return PartOutValue.builder()
                    .last6monthsSalesAvg(last6monthsSalesAvg)
                    .pieces(Integer.valueOf(form.selectXpath("//tr[3]/td[1]//font[3]//b[1]").text()))
                    .lots(Integer.valueOf(form.selectXpath("//tr[3]/td[1]//font[3]//b[2]").text()))
                    .link(url)
                    .build();
        }

    }

    protected BigDecimal parsePrice(String price) {
        if (StringUtils.isBlank(price)) {
            return null;
        }
        if (price.contains(",") && price.contains(".")) {
            price = price.replace(",", "");
        }
        var trimmed = price.replace(" ", "").replace(",", ".");
        if (price.contains("EUR")) {
            return new BigDecimal(trimmed.replace("EUR","")).setScale(2, RoundingMode.HALF_UP);
        } else {
            return new BigDecimal(trimmed.replace("US", "").replace("$", "")).multiply(currencyRate).setScale(2, RoundingMode.HALF_UP);
        }
    }
}
