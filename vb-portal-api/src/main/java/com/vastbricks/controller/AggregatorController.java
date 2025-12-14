package com.vastbricks.controller;

import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.ProductPurchaseRepository;
import com.vastbricks.jpa.repository.ProductRepository;
import com.vastbricks.jpa.repository.ProductPurchaseRepository.PurchaseRow;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.ArrayList;
import java.util.Comparator;


@Controller
@AllArgsConstructor
public class AggregatorController {

    private BrickSetRepository brickSetRepository;
    private ProductRepository productRepository;
    private ProductPurchaseRepository productPurchaseRepository;

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
        model.addAttribute("purchases", purchases);
        var totalSpent = purchases.stream()
                .map(p -> p.getTotalAmount() == null ? java.math.BigDecimal.ZERO : p.getTotalAmount())
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        model.addAttribute("totalSpent", totalSpent);
        model.addAttribute("stores", productRepository.findWebStores());
        return "purchases";
    }

}
