package com.vastbricks.webstore;

import com.vastbricks.config.LoggingInterceptor;
import com.vastbricks.market.link.TorRestTemplate;
import lombok.Builder;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
public abstract class HtmlScraper implements Scraper {

    @Builder
    @Setter
    static final class ScraperArgs {
        private List<String> urls;
        private Integer page;
        private String itemsCssQuery;
        private DocumentProcessor documentProcessor;
        private ItemProcessor itemProcessor;
        private boolean useTor;
        private Map<String, String> headers;
        private Boolean randomThinkTime = false;
    }

    interface DocumentProcessor {
        boolean process(Document document, Integer page);
    }

    interface ItemProcessor {
        WebSet process(Element element);
    }

    @Override
    public List<WebSet> scrape() {
        var result = new ArrayList<WebSet>();
        var args = scraperArgs();
        for (var url : args.urls) {
            var page = args.page;

            var hasMorePages = true;

            while (hasMorePages) {
                hasMorePages = page != null;
                try {

                    var headers = new HttpHeaders();
                    if (args.headers!=null) {
                        args.headers.forEach(headers::add);
                    }

                    var entity = new HttpEntity<>(headers);

                    log.info("Scrapping %s Page: %s".formatted(getWebStore(), (page)));
                    if (args.randomThinkTime !=null) {
                        int seconds = ThreadLocalRandom.current().nextInt(2, 8);
                        Thread.sleep(seconds * 1000);
                    }
                    var html = getHtml();
                    if (html == null) {
                        html = args.useTor ? new TorRestTemplate().getForEntity(url, String.class, page != null ? Map.of("page", page) : Map.of()).getBody() :
                                             getRestTemplate().exchange(url, HttpMethod.GET, entity, String.class, page != null ? Map.of("page", page) : Map.of()).getBody()
                        ;
                    }else {
                        hasMorePages = false;
                    }

                    html = modifyBody(html);


                    var doc = Jsoup.parse(html);

                    if (args.documentProcessor!=null && !args.documentProcessor.process(doc, page)){
                        break;
                    }
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
                                    webSet.setStore(webSet.getStore() == null ? getWebStore() : webSet.getStore());
                                    if (webSet.getStore() != null) {
                                        result.add(webSet);
                                    }
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
        }
        return result;
    }

    public static BigDecimal parsePrice(String price) {
        if (StringUtils.isBlank(price)) {
            return null;
        }
        if (price.contains(",") && price.contains(".")) {
            price = price.replace(",", "");
        }
        return new BigDecimal(price.replace(" ", "").replace(",", ".").replace("€", ""));
    }

    protected abstract ScraperArgs scraperArgs();

    protected String getHtml() {
        return null;
    }

    protected String modifyBody(String string) {
        return string;
    }


    private RestTemplate getRestTemplate() {
        var template = new RestTemplate();
//        // Allow multiple reads of the response body
//        template.setRequestFactory(new BufferingClientHttpRequestFactory(new SimpleClientHttpRequestFactory()));
//
//        // Add logging interceptor
//        template.setInterceptors(Collections.singletonList(new LoggingInterceptor()));
//
//        var jsonConverter = new MappingJackson2HttpMessageConverter();
//        jsonConverter.setSupportedMediaTypes(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.TEXT_HTML));
//        template.getMessageConverters().add(jsonConverter);
        return template;
    }
}
