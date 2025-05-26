package com.vastbricks.controller;

import com.vastbricks.jpa.repository.BrickSetRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;


@Controller
@AllArgsConstructor
public class AggregatorController {

    private BrickSetRepository brickSetRepository;

    @GetMapping("/")
    public String home(
            @RequestParam(value = "set", required = false) Long set,
            @RequestParam(value = "ean", required = false) Long ean,
            Model model) {
        var offers = brickSetRepository.findBestOffers(set, ean);
        model.addAttribute("bestPrices", offers);
        return "home";
    }

    @GetMapping("/product")
    public String product(
            @RequestParam(value = "set", required = false) Long set,
            @RequestParam(value = "ean", required = false) Long ean,
            @RequestParam(value = "store", required = false) String store,
            Model model) {

        if (set == null && ean == null) {
            return "not-found";
        }
        var offers = brickSetRepository.findBestOffers(set, ean);
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
