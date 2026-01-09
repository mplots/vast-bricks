package com.vastbricks.controller;

import com.vastbricks.config.Env;
import com.vastbricks.job.PartOutValueJob;
import com.vastbricks.job.WebStoreScraperJob;
import com.vastbricks.jpa.projection.BestOffer;
import com.vastbricks.jpa.projection.Price;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.MaterializedViewRefresh;
import com.vastbricks.jpa.repository.PartUsageRepository;
import com.vastbricks.jpa.repository.InventoryRepository;
import com.vastbricks.service.PartUsageService;
import com.vastbricks.market.link.PartOutValue;
import com.vastbricks.market.link.PrivateAPI;
import com.vastbricks.shipping.LatvijasPastsClient;
import com.vastbricks.shipping.Order;
import com.vastbricks.shipping.Tariff;
import com.vastbricks.webstore.AioScraper;
import com.vastbricks.webstore.BalticGuruScraper;
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
import java.nio.file.Path;
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
    private PartUsageRepository partUsageRepository;
    private InventoryRepository inventoryRepository;
    private PartUsageService partUsageService;

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

    @GetMapping("/api/parts/usage")
    public PartUsageRowPage partUsage(@RequestParam("partNum") String partNum,
                                      @RequestParam("colorId") Integer colorId,
                                      @RequestParam(value = "limit", required = false, defaultValue = "20") Integer limit,
                                      @RequestParam(value = "offset", required = false, defaultValue = "0") Integer offset,
                                      @RequestParam(value = "sort", required = false, defaultValue = "ratio") String sort,
                                      @RequestParam(value = "dir", required = false, defaultValue = "desc") String dir) {
        var safeLimit = limit == null || limit <= 0 ? 20 : Math.min(limit, 100);
        var safeOffset = offset == null || offset < 0 ? 0 : offset;
        var safeSort = sort == null ? "ratio" : sort.toLowerCase();
        if (!safeSort.equals("ratio") && !safeSort.equals("qty") && !safeSort.equals("price") && !safeSort.equals("partout")) {
            safeSort = "ratio";
        }
        var safeDir = dir == null ? "desc" : dir.toLowerCase();
        if (!safeDir.equals("asc") && !safeDir.equals("desc")) {
            safeDir = "desc";
        }
        var total = partUsageRepository.countTopUsage(partNum, colorId);
        var rows = partUsageRepository.findTopUsage(partNum, colorId, safeLimit, safeOffset, safeSort, safeDir).stream()
                .map(PartUsageRow::from)
                .toList();
        return new PartUsageRowPage(total, safeOffset, safeLimit, rows, safeSort, safeDir);
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

    public record PartUsageRow(Long setNumber,
                               String setName,
                               Integer partQty,
                               BigDecimal partOutPrice,
                               BigDecimal partOutRatio,
                               String partOutLink,
                               BigDecimal setPrice,
                               String webStore,
                               String image) {
        private static PartUsageRow from(PartUsageRepository.PartUsageRow row) {
            return new PartUsageRow(
                    row.getSetNumber(),
                    row.getSetName(),
                    row.getPartQty(),
                    row.getPartOutPrice(),
                    row.getPartOutRatio(),
                    row.getPartOutLink(),
                    row.getSetPrice(),
                    row.getWebStore(),
                    row.getImage()
            );
        }
    }

    public record PartUsageRowPage(long total,
                                   int offset,
                                   int limit,
                                   List<PartUsageRow> items,
                                   String sort,
                                   String dir) { }

    @PostMapping("/api/parts/usage-multi")
    public PartUsageMultiPage partUsageMulti(@RequestBody PartUsageMultiRequest request) {
        var parts = request.parts() == null ? List.<PartUsageService.PartKey>of() : request.parts().stream()
                .filter(p -> p.partNum() != null && !p.partNum().isBlank() && p.colorId() != null)
                .map(p -> new PartUsageService.PartKey(p.partNum().trim(), p.colorId()))
                .toList();
        var limit = request.limit() == null || request.limit() <= 0 ? 20 : Math.min(request.limit(), 100);
        var offset = request.offset() == null || request.offset() < 0 ? 0 : request.offset();
        var sort = request.sort() == null ? "ratio" : request.sort().toLowerCase();
        if (!sort.equals("ratio") && !sort.equals("qty") && !sort.equals("price") && !sort.equals("partout")) {
            sort = "ratio";
        }
        var dir = request.dir() == null ? "desc" : request.dir().toLowerCase();
        if (!dir.equals("asc") && !dir.equals("desc")) {
            dir = "desc";
        }
        var page = partUsageService.fetchUsage(parts, limit, offset, sort, dir);
        return new PartUsageMultiPage(page.total(), page.offset(), page.limit(),
                page.items().stream().map(PartUsageMultiRow::from).toList(),
                page.sort(), page.dir());
    }

    @GetMapping("/api/inventory")
    public InventoryPage inventory(@RequestParam(value = "offset", required = false, defaultValue = "0") Integer offset,
                                   @RequestParam(value = "limit", required = false, defaultValue = "10") Integer limit) {
        var safeLimit = limit == null || limit <= 0 ? 10 : Math.min(limit, 200);
        var safeOffset = offset == null || offset < 0 ? 0 : offset;
        var inventoryFile = env.getBsxInventoryFile();
        if (inventoryFile == null || inventoryFile.isBlank()) {
            return new InventoryPage(0, safeOffset, safeLimit, List.of());
        }
        var filename = Path.of(inventoryFile).getFileName().toString();
        var total = inventoryRepository.countInventory(filename);
        var rows = inventoryRepository.findInventoryPage(filename, safeLimit, safeOffset).stream()
                .map(InventoryRow::from)
                .toList();
        return new InventoryPage(total, safeOffset, safeLimit, rows);
    }

    public record InventoryPage(long total,
                                int offset,
                                int limit,
                                List<InventoryRow> items) { }

    public record PartUsageMultiRequest(List<PartKeyRequest> parts,
                                        Integer limit,
                                        Integer offset,
                                        String sort,
                                        String dir) { }

    public record PartKeyRequest(String partNum, Integer colorId) { }

    public record PartUsageMultiPage(long total,
                                     int offset,
                                     int limit,
                                     List<PartUsageMultiRow> items,
                                     String sort,
                                     String dir) { }

    public record PartUsageMultiRow(Long setNumber,
                                    String setName,
                                    Integer totalQty,
                                    BigDecimal partOutPrice,
                                    BigDecimal partOutRatio,
                                    String partOutLink,
                                    BigDecimal setPrice,
                                    String webStore,
                                    String image) {
        private static PartUsageMultiRow from(PartUsageService.PartUsageRow row) {
            return new PartUsageMultiRow(
                    row.setNumber(),
                    row.setName(),
                    row.totalQty(),
                    row.partOutPrice(),
                    row.partOutRatio(),
                    row.partOutLink(),
                    row.setPrice(),
                    row.webStore(),
                    row.image()
            );
        }
    }

    public record InventoryRow(String partNum,
                               String partName,
                               String colorName,
                               Integer colorId,
                               Integer totalQty,
                               Integer soldQty,
                               Integer remainingQty,
                               Integer orderCount,
                               Integer percent,
                               String imageUrl) {
        private static InventoryRow from(InventoryRepository.InventoryRow row) {
            var remaining = row.getRemainingQty() == null ? 0 : row.getRemainingQty();
            var sold = row.getSoldQty() == null ? 0 : row.getSoldQty();
            var orders = row.getOrderCount() == null ? 0 : row.getOrderCount();
            var total = remaining + sold;
            var percent = total <= 0 ? 0 : (int) Math.min(100, Math.round((sold * 100.0) / total));
            var imageUrl = buildPartImageUrl(row.getPartNum(), row.getColorId());
            return new InventoryRow(
                    row.getPartNum(),
                    row.getPartName(),
                    row.getColorName(),
                    row.getColorId(),
                    total,
                    sold,
                    remaining,
                    orders,
                    percent,
                    imageUrl
            );
        }
    }

    private static String buildPartImageUrl(String partNum, Integer colorId) {
        if (partNum == null || partNum.isBlank()) {
            return null;
        }
        var color = colorId == null ? "0" : colorId.toString();
        return "https://img.bricklink.com/ItemImage/PN/%s/%s.png".formatted(color, partNum.trim());
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

    @CrossOrigin(origins = "https://balticguru.eu/")
    @PostMapping("/api/balticguru")
    public void balticguru(@RequestBody Request request) {
        var scraper = new BalticGuruScraper(){
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
