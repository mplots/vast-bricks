package com.vastbricks.controller;

import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.ProductRepository;
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

    @GetMapping("/")
    public String home(
            @RequestParam(value = "limit", required = false, defaultValue = "200") Integer limit,
            @RequestParam(value = "set", required = false) Long set,
            @RequestParam(value = "ean", required = false) Long ean,
            @RequestParam(value = "atl", required = false, defaultValue = "false") Boolean atl,
            @RequestParam(value = "stores", required = false) String[] stores,
            @RequestParam(value = "themes", required = false) String[] themes,
            Model model) {
        var offers = brickSetRepository.findBestOffers(limit, set, ean, atl, stores, themes);
        model.addAttribute("bestPrices", offers);

        var storesList = new ArrayList<>(productRepository.findWebStores());
        var storesWithOffers = brickSetRepository.findStoresWithOffersInLastReport();
        storesList.sort(Comparator
                .comparing((String store) -> !storesWithOffers.contains(store))
                .thenComparing(String::compareToIgnoreCase));
        model.addAttribute("stores", storesList);
        model.addAttribute("storesWithOffers", storesWithOffers);
        model.addAttribute("themes", brickSetRepository.getAllThemes());
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
        var offers = brickSetRepository.findBestOffers(null, set, ean, atl, null, null);
        if (offers.size() == 1) {
            var offer = offers.get(0);
            var prices = store == null ? brickSetRepository.findSingleBestPrices(offer.getSetNumber()) : brickSetRepository.findPricesForStore(offer.getSetNumber(), store);
            model.addAttribute("offer", offer);
            model.addAttribute("prices", prices);
            return "product";
        } else {
            return "not-found";
        }
    }

    @GetMapping("/splash")
    public String splash() {
        return "splash";
    }

}
