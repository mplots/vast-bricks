package com.vastbricks.job;

import com.vastbricks.jpa.entity.BrickSet;
import com.vastbricks.jpa.entity.BrickSetPartOutPrice;
import com.vastbricks.jpa.entity.Marketplace;
import com.vastbricks.jpa.repository.BrickSetPartOutPriceRepository;
import com.vastbricks.jpa.repository.BrickSetRepository;
import com.vastbricks.jpa.repository.OwlSetRepository;
import com.vastbricks.market.link.LinkClient;
import jakarta.persistence.EntityManager;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.math.NumberUtils;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@AllArgsConstructor
@Component
@Slf4j
public class PartOutValueJob {

    private BrickSetRepository brickSetRepository;
    private BrickSetPartOutPriceRepository brickSetPartOutPriceRepository;
    private EntityManager entityManager;
    private OwlSetRepository owlSetRepository;

//    @Scheduled(cron = "0 1 * * * *")
    public void runJob() {
        var sets = owlSetRepository.findAllSetNumbers().stream().filter(e->NumberUtils.isParsable(e)).toList();
        synchronizeBrickSetPartOutPrices(sets);
    }

    public void synchronizeBrickSetPartOutPrices(List<String> sets) {
        var client = new LinkClient();
        for (var set : sets) {
            try {
                var value = client.internal().partOutValue(set);
                if (value != null) {
                    var partOutPrice = new BrickSetPartOutPrice();
                    partOutPrice.setLink(value.getLink());
                    partOutPrice.setTimestamp(LocalDateTime.now());
                    partOutPrice.setBrickSet(entityManager.getReference(BrickSet.class, set));
                    partOutPrice.setPrice(value.getLast6monthsSalesAvg());
                    partOutPrice.setMarketplace(Marketplace.BRICK_LINK.name());
                    brickSetPartOutPriceRepository.upsert(partOutPrice);

                    var brickSet = brickSetRepository.findById(Long.valueOf(set));
                    if (brickSet.isPresent()) {
                        brickSet.get().setPieces(value.getPieces());
                        brickSet.get().setLots(value.getLots());
                        brickSetRepository.save(brickSet.get());
                    }

                }
            } catch (Exception e) {
                log.error(e.getMessage(), e);
            }
        }
    }

    @Async
    public void runJobAsync() {
        runJob();
    }
}
