package com.vastbricks.controller;

import com.vastbricks.config.Env;
import com.vastbricks.job.PartOutValueJob;
import com.vastbricks.job.WebStoreScraperJob;
import com.vastbricks.jpa.projection.BestOffer;
import com.vastbricks.jpa.projection.Price;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.MaterializedViewRefresh;
import com.vastbricks.market.link.PartOutValue;
import com.vastbricks.market.link.PrivateAPI;
import com.vastbricks.shipping.LatvijasPastsClient;
import com.vastbricks.shipping.Order;
import com.vastbricks.shipping.Tariff;
import com.vastbricks.webstore.AioScraper;
import com.vastbricks.webstore.SalidziniScraper;
import com.vastbricks.webstore.WebSet;
import com.vastbricks.webstore._1aScraper;
import com.vastbricks.webstore._220Scraper;
import com.vastbricks.jpa.repository.ProductPurchaseRepository;
import lombok.AllArgsConstructor;
import lombok.Data;
import org.apache.commons.lang3.StringUtils;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

@RestController
@AllArgsConstructor
public class ApiController {

    private BrickSetRepository brickSetRepository;
    private WebStoreScraperJob storeScraperJob;
    private PartOutValueJob partOutValueJob;
    private MaterializedViewRefresh materializedViewRefresh;
    private Env env;
    private ProductPurchaseRepository productPurchaseRepository;

    @PostMapping("/api/web-sets")
    public void storeWebSets(@RequestBody List<WebSet> webSets) {
        storeScraperJob.storeWebSets(webSets, false);
    }


    @GetMapping("/api/fetch-part-out")
    public PartOutValue fetchPartOut(@RequestParam(value = "set") String set) {
        var result =  partOutValueJob.fetchAndSyncPartOutValue(set);
        materializedViewRefresh.refreshCheapestOfferView();
        return result;
    }

    //External Scrappers
    @Data
    public static final class Request {
        private Long setNumber;
        private String html;
    }

    @CrossOrigin(origins = "https://www.salidzini.lv")
    @GetMapping(value = "/api/offers")
    public List<BestOffer> home(
            @RequestParam(value = "limit", required = false, defaultValue = "200") Integer limit,
            @RequestParam(value = "set", required = false) Long set,
            @RequestParam(value = "ean", required = false) Long ean,
            @RequestParam(value = "atl", required = false, defaultValue = "false") Boolean atl,
            @RequestParam(value = "purchased", required = false, defaultValue = "false") Boolean purchased,
            @RequestParam(value = "stores", required = false) String[] stores,
            @RequestParam(value = "themes", required = false) String[] themes) {

        var offers = brickSetRepository.findBestOffers(limit, set, ean, atl, stores, themes, purchased);
        if (purchased) {
            var purchasedSets = productPurchaseRepository.findDistinctSetNumbers();
            offers = offers.stream()
                    .filter(o -> purchasedSets.contains(o.getSetNumber()))
                    .toList();
        }
        return offers;
    }

    @Data
    @AllArgsConstructor
    public static class ProductDetailsResponse {
        private BestOffer offer;
        private List<Price> prices;
    }

    @GetMapping(value = "/api/product-details")
    public List<ProductDetailsResponse> productDetails(
            @RequestParam(value = "limit", required = false, defaultValue = "200") Integer limit,
            @RequestParam(value = "set", required = false) Long set,
            @RequestParam(value = "ean", required = false) Long ean,
            @RequestParam(value = "atl", required = false, defaultValue = "false") Boolean atl,
            @RequestParam(value = "purchased", required = false, defaultValue = "false") Boolean purchased,
            @RequestParam(value = "stores", required = false) String[] stores,
            @RequestParam(value = "themes", required = false) String[] themes) {

        var offers = brickSetRepository.findBestOffers(limit, set, ean, atl, stores, themes, purchased);
        if (purchased) {
            var purchasedSets = productPurchaseRepository.findDistinctSetNumbers();
            offers = offers.stream()
                    .filter(o -> purchasedSets.contains(o.getSetNumber()))
                    .toList();
        }
        return offers.stream()
                .map(offer -> new ProductDetailsResponse(offer, brickSetRepository.findSingleBestPrices(offer.getSetNumber())))
                .toList();
    }

    @CrossOrigin(origins = "https://www.salidzini.lv")
    @PostMapping("/api/salidzini")
    public void salidzini(@RequestBody Request request) {

        var scraper = new SalidziniScraper(){
            @Override
            protected String getHtml() {
                return request.getHtml();
            }
        };

        var webSets = scraper.scrape(List.of(request.getSetNumber()));
        if (webSets.size() == 0) {
            throw new RuntimeException("Fail");
        }
        webSets = webSets.stream().filter(e->!e.getStore().equals("anete.lv") && !e.getImage().contains("noimage")).toList();
        storeScraperJob.storeWebSets(webSets, false);
    }

    @CrossOrigin(origins = "https://220.lv/")
    @PostMapping("/api/220")
    public void _220(@RequestBody Request request) {
        var scraper = new _220Scraper(){
            @Override
            protected String getHtml() {
                return request.getHtml();
            }
        };
        storeScraperJob.storeWebSets(scraper.scrape(), false);
    }

    @CrossOrigin(origins = "https://www.1a.lv/")
    @PostMapping("/api/1a")
    public void _1a(@RequestBody Request request) {
        var scraper = new _1aScraper(){
            @Override
            protected String getHtml() {
                return request.getHtml();
            }
        };
        storeScraperJob.storeWebSets(scraper.scrape(), false);
    }

    @CrossOrigin(origins = "https://aio.lv/")
    @PostMapping("/api/aio")
    public void aio(@RequestBody Request request) {
        var scraper = new AioScraper(){
            @Override
            protected String getHtml() {
                return request.getHtml();
            }
        };
        storeScraperJob.storeWebSets(scraper.scrape(), false);
    }

    @Data
    public static class ShippingRequest {
        private Long orderId;
        private BigDecimal weight;
    }

    @Data
    @AllArgsConstructor
    public static class ShippingResponse {
        private String orderNumber;
    }

    @CrossOrigin(origins = "https://www.bricklink.com")
    @PostMapping("/api/bricklink/shipping-request")
    public byte[] prepareBricklinkShipping(@RequestBody ShippingRequest shippingRequest) {
        var order = new PrivateAPI(env.getBrickLinkConsumerKey(), env.getBrickLinkConsumerSecret(), env.getBrickLinkToken(), env.getBrickLinkTokenSecret())
                .getOrder(shippingRequest.getOrderId());

        var address = order.getData().getShipping().getAddress();

        var client = new LatvijasPastsClient();

        var mode = Tariff.Mode.SIMPLE;
        if (order.getData().getCost().getEtc2().compareTo(BigDecimal.ZERO) > 0) {
            mode = Tariff.Mode.TRACEABLE;
        }

        var cookie = client.login(env.getMansPastsUsername(), env.getMansPastsPassword());
        return client.createOrder(
            Order.builder()
                .cookie(cookie)
                .type(Tariff.Type.SMALL_PACKAGE)
                .mode(mode)
                .fullName(address.getName().getFull())
                .telephone(address.getPhoneNumber())
                .email(order.getData().getBuyerEmail())
                .address1(join(address.getAddress1(), address.getAddress2()))
                .address2(join(address.getState(), address.getCity()))
                .state(address.getState())
                .country(order.getData().getShipping().getAddress().getCountryCode())
                .postcode(order.getData().getShipping().getAddress().getPostalCode())
                .weight(shippingRequest.getWeight())
                .packValue(order.getData().getCost().getSubtotal())
                .quantity(order.getData().getTotalCount())
            .build()
        );
    }

    private String join(String ... strings) {
        return StringUtils.join(Arrays.stream(strings).filter(StringUtils::isNotBlank).distinct().toArray(), ", ");
    }

}
