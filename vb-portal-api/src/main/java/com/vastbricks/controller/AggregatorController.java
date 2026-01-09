package com.vastbricks.controller;

import com.vastbricks.bsx.BsxParser;
import org.apache.commons.text.StringEscapeUtils;
import com.vastbricks.config.Env;
import com.vastbricks.jpa.entity.Marketplace;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.OrderQrRegistrationRepository;
import com.vastbricks.jpa.repository.ProductPurchaseRepository;
import com.vastbricks.jpa.repository.ProductRepository;
import com.vastbricks.service.PurchaseProgressService;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.nio.file.Files;
import java.nio.file.Path;


@Controller
@AllArgsConstructor
public class AggregatorController {

    private BrickSetRepository brickSetRepository;
    private ProductRepository productRepository;
    private ProductPurchaseRepository productPurchaseRepository;
    private OrderQrRegistrationRepository orderQrRegistrationRepository;
    private Env env;
    private BsxParser bsxParser;
    private PurchaseProgressService purchaseProgressService;

    @GetMapping("/")
    public String home(
            @RequestParam(value = "limit", required = false, defaultValue = "200") Integer limit,
            @RequestParam(value = "set", required = false) Long set,
            @RequestParam(value = "ean", required = false) Long ean,
            @RequestParam(value = "atl", required = false, defaultValue = "false") Boolean atl,
            @RequestParam(value = "purchased", required = false, defaultValue = "false") Boolean purchased,
            @RequestParam(value = "stores", required = false) String[] stores,
            @RequestParam(value = "themes", required = false) String[] themes,
            Model model) {
        var offers = brickSetRepository.findBestOffers(limit, set, ean, atl, stores, themes, purchased);
        if (purchased) {
            var purchasedSets = productPurchaseRepository.findDistinctSetNumbers();
            offers = offers.stream()
                    .filter(o -> purchasedSets.contains(o.getSetNumber()))
                    .toList();
        }
        model.addAttribute("bestPrices", offers);

        var storesList = new ArrayList<>(productRepository.findWebStores());
        var storesWithOffers = brickSetRepository.findStoresWithOffersInLastReport();
        storesList.sort(Comparator
                .comparing((String store) -> !storesWithOffers.contains(store))
                .thenComparing(String::compareToIgnoreCase));
        model.addAttribute("stores", storesList);
        model.addAttribute("storesWithOffers", storesWithOffers);
        model.addAttribute("themes", brickSetRepository.getAllThemes());
        model.addAttribute("purchasedFilter", purchased);
        return "home";
    }

    @GetMapping("/product")
    public String product(
            @RequestParam(value = "set", required = false) Long set,
            @RequestParam(value = "ean", required = false) Long ean,
            @RequestParam(value = "store", required = false) String store,
            @RequestParam(value = "atl", required = false, defaultValue = "false") Boolean atl,
            Model model) {

        if (set == null && ean == null) {
            return "not-found";
        }
        var offers = brickSetRepository.findBestOffers(null, set, ean, atl, null, null, false);
        if (offers.size() == 1) {
            var offer = offers.get(0);
            var prices = store == null ? brickSetRepository.findSingleBestPrices(offer.getSetNumber()) : brickSetRepository.findPricesForStore(offer.getSetNumber(), store);
            var priceHistory = brickSetRepository.findAllPricesForSet(offer.getSetNumber());
            var purchases = productPurchaseRepository.findAllWithSetOrdered().stream()
                    .filter(p -> p.getSetNumber().equals(offer.getSetNumber()))
                    .toList();
            model.addAttribute("offer", offer);
            model.addAttribute("prices", prices);
            model.addAttribute("priceHistory", priceHistory);
            model.addAttribute("purchaseHistory", purchases);
            return "product";
        } else {
            return "not-found";
        }
    }

    @GetMapping("/splash")
    public String splash() {
        return "splash";
    }

    @GetMapping("/purchases")
    public String purchases(Model model) {
        var purchases = productPurchaseRepository.findAllWithSetOrdered();
        var progress = purchaseProgressService.buildProgress(purchases);
        var rows = purchases.stream()
                .map(row -> PurchaseProgressRow.from(row, progress.get(row.getId())))
                .toList();
        model.addAttribute("purchases", rows);
        var totalSpent = purchases.stream()
                .map(p -> p.getTotalAmount() == null ? java.math.BigDecimal.ZERO : p.getTotalAmount())
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        model.addAttribute("totalSpent", totalSpent);
        var totalPurchased = purchases.stream()
                .map(p -> p.getQuantity() == null ? 0 : p.getQuantity())
                .reduce(0, Integer::sum);
        var totalItemsSold = progress.values().stream()
                .map(PurchaseProgressService.PurchaseProgress::soldParts)
                .reduce(0, Integer::sum);
        var totalItems = progress.values().stream()
                .map(PurchaseProgressService.PurchaseProgress::totalParts)
                .reduce(0, Integer::sum);
        var totalItemsPercent = totalItems <= 0 ? 0 : (int) Math.min(100, Math.round((totalItemsSold * 100.0) / totalItems));
        model.addAttribute("totalPurchased", totalPurchased);
        model.addAttribute("totalItemsSold", totalItemsSold);
        model.addAttribute("totalItems", totalItems);
        model.addAttribute("totalItemsPercent", totalItemsPercent);
        model.addAttribute("stores", productRepository.findWebStores());
        return "purchases";
    }

    @GetMapping("/links")
    public String links(@RequestParam(value = "qrid", required = false) String qrid, Model model) {
        if (qrid == null || qrid.isBlank()) {
            return "links";
        }

        var trimmedQrid = qrid.trim();
        var registration = orderQrRegistrationRepository.findByQrid(trimmedQrid);
        if (registration.isEmpty()) {
            return "links";
        }

        var entry = registration.get();
        var source = entry.getSource();
        var sourceLabel = source == Marketplace.BRICK_LINK ? "BrickLink" : "Brick Owl";
        var filePrefix = source == Marketplace.BRICK_LINK ? "bricklink" : "brickowl";
        var fileName = "%s-%s.bsx".formatted(filePrefix, entry.getOrderId());

        var bsxDir = env.getBsxOrderDir();
        if (bsxDir == null || bsxDir.isBlank()) {
            return "links";
        }

        var path = Path.of(bsxDir).resolve(fileName);
        if (!Files.exists(path)) {
            return "links";
        }

        var bsx = bsxParser.parse(path).orElse(null);
        if (bsx == null || bsx.getOrder() == null) {
            return "links";
        }

        var customerName = formatCustomerName(bsx.getOrder().getCustomer());
        if (customerName == null || customerName.isBlank()) {
            return "links";
        }

        model.addAttribute("orderThanks", true);
        model.addAttribute("orderId", entry.getOrderId());
        model.addAttribute("orderSource", sourceLabel);
        var orderUrl = source == Marketplace.BRICK_LINK
            ? "https://www.bricklink.com/orderDetail.asp?ID=" + entry.getOrderId()
            : "https://www.brickowl.com";
        model.addAttribute("orderUrl", orderUrl);
        model.addAttribute("customerName", customerName);
        var feedbackUrl = source == Marketplace.BRICK_LINK
            ? "https://www.bricklink.com/orderPlaced.asp"
            : "https://www.brickowl.com";
        model.addAttribute("feedbackUrl", feedbackUrl);
        var items = bsx.getInventory() == null ? null : bsx.getInventory().getItems();
        if (items != null && !items.isEmpty()) {
            var itemSummaries = items.stream()
                .filter(item -> item.getItemName() != null && item.getQty() != null)
                .map(item -> new ItemSummary(
                    StringEscapeUtils.unescapeJava(item.getItemName()),
                    item.getQty(),
                    buildItemImageUrl(item)
                ))
                .toList();
            model.addAttribute("orderItems", itemSummaries);
        }
        return "links";
    }

    @GetMapping("/jobs")
    public String jobs(Model model) {
        model.addAttribute("stores", productRepository.findWebStores());
        return "jobs";
    }

    private String formatCustomerName(String rawName) {
        if (rawName == null) {
            return null;
        }
        var trimmed = rawName.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        var first = trimmed.split("\\s+")[0];
        if (first.isEmpty()) {
            return null;
        }
        var lower = first.toLowerCase();
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private String buildItemImageUrl(com.vastbricks.bsx.Item item) {
        if (item == null || item.getItemId() == null || item.getItemTypeId() == null) {
            return null;
        }
        var type = item.getItemTypeId().trim().toUpperCase();
        if (type.isEmpty()) {
            return null;
        }
        var folder = switch (type) {
            case "P" -> "PN";
            case "M" -> "MN";
            case "S" -> "SN";
            case "G" -> "GN";
            case "I" -> "IN";
            case "B" -> "BN";
            case "O" -> "ON";
            default -> null;
        };
        if (folder == null) {
            return null;
        }
        var color = item.getColorId() == null ? "0" : item.getColorId().toString();
        return "https://img.bricklink.com/ItemImage/%s/%s/%s.png".formatted(folder, color, item.getItemId());
    }

    private record ItemSummary(String name, Integer qty, String imageUrl) { }

    private record PurchaseProgressRow(
            Long id,
            Long setNumber,
            String setName,
            String webStore,
            BigDecimal price,
            Integer quantity,
            LocalDate purchasedAt,
            String purchasedAtDisplay,
            String image,
            BigDecimal totalAmount,
            Integer progressPercent,
            Integer soldParts,
            Integer totalParts
    ) {
        private static PurchaseProgressRow from(ProductPurchaseRepository.PurchaseRow row,
                                                PurchaseProgressService.PurchaseProgress progress) {
            var percent = progress == null ? 0 : progress.percent();
            var sold = progress == null ? 0 : progress.soldParts();
            var total = progress == null ? 0 : progress.totalParts();
            return new PurchaseProgressRow(
                    row.getId(),
                    row.getSetNumber(),
                    row.getSetName(),
                    row.getWebStore(),
                    row.getPrice(),
                    row.getQuantity(),
                    row.getPurchasedAt(),
                    row.getPurchasedAtDisplay(),
                    row.getImage(),
                    row.getTotalAmount(),
                    percent,
                    sold,
                    total
            );
        }
    }

}
