package com.vastbricks.controller;

import com.vastbricks.jpa.entity.WebStore;
import com.vastbricks.jpa.repository.BrickSetRepository;
import lombok.AllArgsConstructor;
import org.apache.catalina.Store;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Arrays;
import java.util.List;


@Controller
@AllArgsConstructor
public class AggregatorController {

    private BrickSetRepository brickSetRepository;

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
        model.addAttribute("stores", Arrays.stream(WebStore.values()).map(e->e.getName()).toList());
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
