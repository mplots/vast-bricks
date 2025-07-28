package com.vastbricks.webstore;


import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

//@Component
public class SalidziniScraper extends HtmlScraper {

    private List<String> urls = new ArrayList<>();

    public List<WebSet> scrape(List<Long> sets) {
        urls = sets.stream().map(e-> "https://www.salidzini.lv/cena?q=lego+" + e).toList();
        var result = super.scrape();
        urls = new ArrayList<>();
        return result;
    }

    @Override
    protected ScraperArgs scraperArgs() {
        return ScraperArgs.builder()
            .urls(urls)
            .useTor(false)
            .itemsCssQuery("div.item_box_main")
            .randomThinkTime(true)
            .headers(new HashMap<>(){{
                put("accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7");
                put("accept-encoding", "gzip, deflate, br, zstd");
                put("accept-language", "en-GB,en-US;q=0.9,en;q=0.8,lv;q=0.7");
                put("cache-control", "max-age=0");
                put("cookie", "VIID=e33ef3a083706a06ccc77683573f9bfe; _ga=GA1.1.1004869293.1748333561; _gcl_au=1.1.77823906.1748434863; _gcl_gs=2.1.k1$i1750914957$u159716287; _gcl_aw=GCL.1750914961.CjwKCAjwvO7CBhAqEiwA9q2YJTn-9vZdlRnpe7VJ9x4e70JbA6grFrB_YWUkYI-vpk77ac93eoSBgxoCQgIQAvD_BwE; PHPSESSID=af24ec6cc1eee90f15ca3652ad8f4e53; _ga_MF2YE8LTJG=GS2.1.s1751656345$o11$g1$t1751657854$j56$l0$h0");
                put("priority", "u=0, i");
                put("sec-ch-ua", "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"");
                put("sec-ch-ua-mobile", "?0");
                put("sec-ch-ua-platform", "\"macOS\"");
                put("sec-fetch-dest", "document");
                put("sec-fetch-mode", "navigate");
                put("sec-fetch-site", "none");
                put("sec-fetch-user", "?1");
                put("upgrade-insecure-requests", "1");
                put("user-agent","Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36");
            }})
            .itemProcessor(element ->
                WebSet.builder()
                    .name(element.selectFirst("h2.item_name").text() )
                    .price(parsePrice(element.selectFirst("div.item_price").text()))
                    .link("https://www.salidzini.lv/" + element.selectFirst("a.item_link").attr("href"))
                    .image(element.selectFirst("div.item_image").selectFirst("img").attr("src"))
                    .store(element.selectFirst("div.item_shop_name").text())
                .build()
            )
        .build();
    }

    @Override
    public String getWebStore() {
        return "salidzini.lv";
    }
}
