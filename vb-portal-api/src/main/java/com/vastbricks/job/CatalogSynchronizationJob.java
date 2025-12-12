package com.vastbricks.job;

import com.vastbricks.config.Env;
import com.vastbricks.jpa.entity.BaseBrickSet;
import com.vastbricks.jpa.entity.BrickSet;
import com.vastbricks.jpa.entity.BrickSetPartOutPrice;
import com.vastbricks.jpa.entity.Marketplace;
import com.vastbricks.jpa.entity.OwlSet;
import com.vastbricks.jpa.entity.OwlWebSetInventory;
import com.vastbricks.jpa.repository.BaseBrickSetRepository;
import com.vastbricks.jpa.repository.BrickSetPartOutPriceRepository;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.MaterializedViewRefresh;
import com.vastbricks.jpa.repository.OwlSetRepository;
import com.vastbricks.jpa.repository.OwlWebSetInventoryRepository;
import com.vastbricks.market.owl.IdType;
import com.vastbricks.market.owl.Item;
import com.vastbricks.market.owl.OwlClient;
import com.vastbricks.market.owl.ItemType;
import com.vastbricks.market.owl.ListItem;
import jakarta.persistence.EntityManager;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@AllArgsConstructor
@Component
@Slf4j
public class CatalogSynchronizationJob {

    private static final BigDecimal USD_TO_EUR_CURRENCY_RATE = new BigDecimal("0.96");

    private Env env;
    private OwlSetRepository owlSetRepository;
    private OwlWebSetInventoryRepository owlWebSetInventoryRepository;
    private BrickSetRepository brickSetRepository;
    private BrickSetPartOutPriceRepository brickSetPartOutPriceRepository;
    private EntityManager entityManager;
    private PartOutValueJob partOutValueJob;
    private MaterializedViewRefresh materializedViewRefresh;
    private BaseBrickSetRepository baseBrickSetRepository;

    @Scheduled(cron = "0 5 * * * *")
    public void runJob() {
        log.info("Starting Catalog Synchronization Job");
        var owlClient = new OwlClient(env.getBrickOwlApiKey(), env.getBrickOwlCookie());
        var existingBoids = owlSetRepository.findAllCategorizedBoids();
        var newBoids = owlClient.catalog().list(ItemType.SET).stream()
                .filter(e->!existingBoids.contains(e.getBoid()))
                .map(ListItem::getBoid).toList();

        var newSets = new ArrayList<String>();
        chunkList(newBoids, 100).forEach(chunk -> {
            var newOwlSets = owlClient.catalog().bulkLookup(chunk).stream().map(item -> {
                var owlSet = new OwlSet();
                owlSet.setBoid(item.getBoid());
                owlSet.setContents(item);
                return owlSet;
            }).toList();

            newSets.addAll(
                    newOwlSets.stream()
                        .map(e -> e.getSetNumber())
                        .filter(Objects::nonNull)
                        .map(Object::toString)
                        .toList()
            );

            owlSetRepository.saveAll(newOwlSets);
            log.info("New owl sets stored %s".formatted(chunk));
        });

        synchronizeBrickSets();
        partOutValueJob.synchronizeBrickSetPartOutPrices(newSets);

        materializedViewRefresh.refreshCheapestOfferView();

        log.info("Catalog Synchronization Job Completed");
    }

    @Async
    public void runJobAsync() {
        runJob();
    }

    private void synchronizeBrickSets() {
        var existingOwlSetNumbers = owlSetRepository.findAllSetNumbers();
        var existingBrickSetNumbers = brickSetRepository.findAllCategorizedSetNumbers();

        var newOwlSetNumbers = existingOwlSetNumbers.stream().filter(e->!existingBrickSetNumbers.contains(e)).toList();
        var newOwlSets = owlSetRepository.findBySetNumberIn(newOwlSetNumbers);

        var newBrickSets = newOwlSets.stream().map(owlSet->{
            var setNumber = owlSet.getSetNumber();
            var catNamePath = owlSet.getContents().getCatNamePath();
            if (setNumber != null && catNamePath != null) {
                var brickSet = new BaseBrickSet();
                brickSet.setNumber(setNumber);
                brickSet.setName(owlSet.getContents().getName());
                brickSet.setTheme(catNamePath.split(" / ")[1]);
                brickSet.setBoid(owlSet.getBoid());
                brickSet.setEanIds(extract(owlSet.getContents(), IdType.EAN));
                brickSet.setUpcIds(extract(owlSet.getContents(), IdType.UPC));
                return brickSet;
            }
            return null;
        }).filter(Objects::nonNull).toList();

        baseBrickSetRepository.saveAll(newBrickSets);
    }

    private void synchronizeBrickSetPartOutPrices() {
        var brickSet = brickSetRepository.findAllSetNumbers();

        owlWebSetInventoryRepository.findAll().stream().map(set->{
             var owlSetNumber = set.getOwlSet() != null ? set.getOwlSet().getSetNumber() : null;
             if (set.getContents().getPastPriceNew() != null && owlSetNumber != null && brickSet.contains(owlSetNumber.toString())) {
                 var price = new BrickSetPartOutPrice();
                 price.setBrickSet(entityManager.getReference(BrickSet.class, owlSetNumber));
                 price.setPrice(set.getContents().getPastPriceNew().multiply(USD_TO_EUR_CURRENCY_RATE));
                 price.setMarketplace(Marketplace.BRICK_OWL.name());
                 price.setLink(set.getContents().getLink());
                 price.setTimestamp(LocalDateTime.now());
                 return price;
             } else {
                 return null;
             }
        }).filter(Objects::nonNull).toList().forEach(partOutPrice ->
             brickSetPartOutPriceRepository.upsert(partOutPrice)
        );
    }

    private <T> List<List<T>> chunkList(List<T> list, int chunkSize) {
        var size = list.size();
        return IntStream.range(0, (size + chunkSize - 1) / chunkSize)
                .mapToObj(i -> list.subList(i * chunkSize, Math.min(size, (i + 1) * chunkSize))).toList();
    }

    private Set<String> extract(Item item, IdType type) {
        return item.getIds().stream().filter(e->e.getType().equals(type)).map(e->e.getId()).collect(Collectors.toSet());
    }
}
