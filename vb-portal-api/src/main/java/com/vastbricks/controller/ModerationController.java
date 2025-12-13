package com.vastbricks.controller;

import com.vastbricks.jpa.repository.BrickSetOfferRepository;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.MaterializedViewRefresh;
import com.vastbricks.jpa.repository.ProductPurchaseRepository;
import com.vastbricks.jpa.repository.ProductRepository;
import com.vastbricks.jpa.entity.ProductPurchase;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

@RestController
@RequestMapping("/api")
@AllArgsConstructor
@Slf4j
public class ModerationController {

    private ProductRepository productRepository;
    private BrickSetOfferRepository brickSetOfferRepository;
    private BrickSetRepository brickSetRepository;
    private ProductPurchaseRepository productPurchaseRepository;
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

    @Data
    public static class PurchaseRequest {
        @NotNull
        @DecimalMin(value = "0.01", inclusive = true, message = "Price must be greater than zero")
        private BigDecimal price;
        @Positive(message = "Quantity must be positive")
        private Integer quantity;
        private LocalDate purchasedAt;
        @NotBlank
        private String webStore;
        private Long setNumber;
    }

    @PostMapping("/brick-sets/{setNumber}/purchases")
    public void recordPurchase(@PathVariable("setNumber") Long setNumber, @Valid @RequestBody PurchaseRequest request) {
        var quantity = request.getQuantity() == null ? 1 : request.getQuantity();

        var brickSet = brickSetRepository.findById(setNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brick set not found"));

        var purchase = new ProductPurchase();
        purchase.setBrickSet(brickSet);
        purchase.setWebStore(request.getWebStore());
        purchase.setPrice(request.getPrice());
        purchase.setQuantity(quantity);
        purchase.setPurchasedAt(request.getPurchasedAt() != null ? request.getPurchasedAt() : LocalDate.now());
        productPurchaseRepository.save(purchase);

        materializedViewRefresh.refreshCheapestOfferView();
        log.info("Recorded purchase for set {} (store {}) : {} units at {}", setNumber, request.getWebStore(), quantity, request.getPrice());
    }

    @PutMapping("/purchases/{purchaseId}")
    public void updatePurchase(@PathVariable("purchaseId") Long purchaseId, @Valid @RequestBody PurchaseRequest request) {
        var quantity = request.getQuantity() == null ? 1 : request.getQuantity();

        var purchase = productPurchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase not found"));

        var setNumber = request.getSetNumber() != null ? request.getSetNumber() : purchase.getBrickSet().getNumber();
        var brickSet = brickSetRepository.findById(setNumber)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brick set not found"));

        purchase.setBrickSet(brickSet);
        purchase.setWebStore(request.getWebStore());
        purchase.setPrice(request.getPrice());
        purchase.setQuantity(quantity);
        purchase.setPurchasedAt(request.getPurchasedAt() != null ? request.getPurchasedAt() : purchase.getPurchasedAt());

        productPurchaseRepository.save(purchase);
        materializedViewRefresh.refreshCheapestOfferView();
        log.info("Updated purchase {} for set {} (store {})", purchaseId, setNumber, request.getWebStore());
    }

    @DeleteMapping("/purchases/{purchaseId}")
    public void deletePurchase(@PathVariable("purchaseId") Long purchaseId) {
        var purchase = productPurchaseRepository.findById(purchaseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase not found"));
        productPurchaseRepository.delete(purchase);
        materializedViewRefresh.refreshCheapestOfferView();
        log.info("Deleted purchase {}", purchaseId);
    }

}
