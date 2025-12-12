package com.vastbricks.controller;

import com.vastbricks.jpa.repository.BrickSetOfferRepository;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.MaterializedViewRefresh;
import com.vastbricks.jpa.repository.ProductRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api")
@AllArgsConstructor
@Slf4j
public class ModerationController {

    private ProductRepository productRepository;
    private BrickSetOfferRepository brickSetOfferRepository;
    private BrickSetRepository brickSetRepository;
    private MaterializedViewRefresh materializedViewRefresh;

    @PostMapping("/products/{productId}/invalidate")
    public void invalidateProduct(@PathVariable("productId") Long productId) {
        var product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        product.setActive(false);
        productRepository.save(product);
        log.info("Marked product {} as inactive", productId);
        materializedViewRefresh.refreshCheapestOfferView();
    }

    @Transactional
    @PostMapping("/brick-sets/{setNumber}/invalidate-atl")
    public void invalidateAtl(@PathVariable("setNumber") Long setNumber, @RequestParam("price") BigDecimal price) {
        brickSetRepository.findById(setNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brick set not found"));
        var updated = brickSetOfferRepository.deactivateBySetNumberAndPrice(setNumber, price);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No offers found for given ATL price");
        }
        log.info("Marked {} ATL offers inactive for set {} at price {}", updated, setNumber, price);
        materializedViewRefresh.refreshCheapestOfferView();
    }
}
