package com.vastbricks.job;

import com.vastbricks.discord.DiscordClient;
import com.vastbricks.jpa.entity.BrickSetOffer;
import com.vastbricks.jpa.entity.Product;
import com.vastbricks.jpa.repository.BrickSetOfferRepository;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.MaterializedViewRefresh;
import com.vastbricks.jpa.repository.ProductRepository;
import com.vastbricks.webstore.Scraper;
import com.vastbricks.webstore.WebSet;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StopWatch;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Component
@AllArgsConstructor
@Slf4j
public class WebStoreScraperJob {

    private List<Scraper> scrapers;
    private BrickSetRepository brickSetRepository;
    private BrickSetOfferRepository brickSetOfferRepository;
    private ProductRepository productRepository;
    private DiscordClient discordClient;
    private MaterializedViewRefresh materializedViewRefresh;

    @Scheduled(fixedRate=60*60*1000, initialDelay =60*60*1000)
    public void runJob() {
        runJobAsync();
    }

    @Async
    public void runJobAsync() {
        var stores = scrapers.stream().map(e->e.getWebStore()).toList();
        runJobAsync(stores);
    }

    @Async
    public void runJobAsync(List<String> webStore) {
        var webSets = scrapers.stream().filter(e->webStore.contains(e.getWebStore())).map(Scraper::scrape).flatMap(List::stream).toList();
        storeWebSets(webSets, true);

    }

    public void storeWebSets(List<WebSet> webSets, boolean refreshView) {
        var webSetNumbers = webSets.stream().map(WebSet::getNumber).collect(Collectors.toSet());
        var brickSets = brickSetRepository.findByNumberIn(webSetNumbers);
        var brickSetOffers = new ArrayList<BrickSetOffer>();


        var watch = new StopWatch();
        watch.start();
        log.info("Starting to save web sets");

        for (var webSet : webSets) {
            var brickSet = brickSets.stream().filter(e->e.getNumber().equals(webSet.getNumber())).findFirst();
            if (brickSet.isPresent()) {
                var product = new Product();
                product.setName(webSet.getName());
                product.setLink(webSet.getLink());
                product.setImage(webSet.getImage());
                product.setBrickSet(brickSet.get());
                product.setWebStore(webSet.getStore());
                var result = productRepository.upsert(product);
                product.setId(result.getId());

                var brickSetOffer = new BrickSetOffer();
                brickSetOffer.setPrice(webSet.getPrice());
                brickSetOffer.setTimestamp(LocalDateTime.now());
                brickSetOffer.setProduct(product);
                brickSetOffers.add(brickSetOffer);
                brickSetOfferRepository.upsert(brickSetOffer);
                if (!result.getUpdated()) {
                    var offers = brickSetRepository.findBestOffers(null, brickSet.get().getNumber(), null, false, null, null);
                    var prices = brickSetRepository.findSingleBestPrices(brickSet.get().getNumber());
                    if (offers.size() == 1 &&
                            offers.get(0).getPartOutRatio().compareTo(new BigDecimal("4.00")) >= 0 &&
                            prices.get(0).getOfferId().equals(offers.get(0).getLowestOfferId())
                    ) {
                        discordClient.publishMessage("https://vastbricks.com/product?set=%s&store=%s".formatted(brickSet.get().getNumber(), prices.get(0).getWebStore()));
                    }
                }
            } else {
                log.warn("Owl set with number %s not found".formatted(webSet.getNumber()));
            }
        }

        watch.stop();
        if (refreshView) {
            materializedViewRefresh.refreshCheapestOfferView();
        }
        log.info("Completed saving web sets. Time elapsed: %s seconds.".formatted(watch.getTotalTimeSeconds()));
    }

}
