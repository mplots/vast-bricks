package com.vastbricks.job;

import com.vastbricks.bsx.BsxParser;
import com.vastbricks.config.Env;
import com.vastbricks.jpa.entity.bsx.BsxDocument;
import com.vastbricks.jpa.entity.bsx.BsxItem;
import com.vastbricks.jpa.entity.bsx.BsxOrder;
import com.vastbricks.jpa.repository.BsxDocumentRepository;
import com.vastbricks.jpa.repository.BsxItemRepository;
import com.vastbricks.jpa.repository.BsxOrderRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;

@Component
@AllArgsConstructor
@Slf4j
public class BsxImportJob {

    private Env env;
    private BsxParser bsxParser;
    private BsxDocumentRepository bsxDocumentRepository;
    private BsxOrderRepository bsxOrderRepository;
    private BsxItemRepository bsxItemRepository;

    @Scheduled(fixedRate = 60 * 60 * 1000, initialDelay = 60 * 60 * 1000)
    public void runJob() {
        runJobAsync();
    }

    @Async
    public void runJobAsync() {
        var bsxDir = env.getBsxOrderDir();
        if (bsxDir == null || bsxDir.isBlank()) {
            log.info("BSX import skipped: BSX_ORDER_DIR not configured");
            return;
        }
        var dirPath = Path.of(bsxDir);
        if (!Files.exists(dirPath) || !Files.isDirectory(dirPath)) {
            log.warn("BSX import skipped: directory not found {}", dirPath);
            return;
        }
        var existing = new java.util.HashSet<>(bsxDocumentRepository.findAllFilenames());
        try (var stream = Files.list(dirPath)) {
            var imported = stream.filter(path -> path.getFileName().toString().toLowerCase().endsWith(".bsx"))
                    .filter(path -> !existing.contains(path.getFileName().toString()))
                    .map(this::importFileIfNew)
                    .filter(Boolean::booleanValue)
                    .count();
            if (imported == 0) {
                log.info("BSX import finished: no new files");
            } else {
                log.info("BSX import finished: imported {} file(s)", imported);
            }
        } catch (Exception e) {
            log.error("Failed to read BSX directory", e);
        }
    }

    @Transactional
    public boolean importFileIfNew(Path path) {
        var filename = path.getFileName().toString();
        var bsx = bsxParser.parse(path).orElse(null);
        if (bsx == null) {
            log.warn("BSX import failed: unable to parse {}", filename);
            return false;
        }

        var document = new BsxDocument();
        document.setFilename(filename);
        document = bsxDocumentRepository.save(document);

        if (bsx.getOrder() != null) {
            var order = new BsxOrder();
            order.setDocument(document);
            order.setService(bsx.getOrder().getService());
            order.setOrderId(bsx.getOrder().getOrderId());
            order.setOrderDate(bsx.getOrder().getOrderDate());
            order.setCustomer(bsx.getOrder().getCustomer());
            order.setSubTotal(bsx.getOrder().getSubTotal());
            order.setGrandTotal(bsx.getOrder().getGrandTotal());
            order.setPayment(bsx.getOrder().getPayment());
            order.setCurrency(bsx.getOrder().getCurrency());
            bsxOrderRepository.save(order);
        }

        var items = bsx.getInventory().getItems();
        if (items == null || items.isEmpty()) {
            log.info("BSX import stored document {} with empty inventory", filename);
            return true;
        }

        var entities = new ArrayList<BsxItem>(items.size());
        for (var item : items) {
            if (item == null) {
                continue;
            }
            var entity = new BsxItem();
            entity.setDocument(document);
            entity.setItemId(item.getItemId());
            entity.setItemTypeId(item.getItemTypeId());
            entity.setColorId(item.getColorId());
            entity.setItemName(item.getItemName());
            entity.setItemTypeName(item.getItemTypeName());
            entity.setColorName(item.getColorName());
            entity.setStatus(item.getStatus());
            entity.setQty(item.getQty());
            entity.setOrigQty(item.getOrigQty());
            entity.setPrice(item.getPrice());
            entity.setSalePrice(item.getSalePrice());
            entity.setCondition(item.getCondition());
            entity.setRemarks(item.getRemarks());
            entity.setLotId(item.getLotId());
            entities.add(entity);
        }
        bsxItemRepository.saveAll(entities);
        log.info("BSX import stored document {} with {} item(s)", filename, entities.size());
        return true;
    }
}
