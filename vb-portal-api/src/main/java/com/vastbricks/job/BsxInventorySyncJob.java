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
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;

@Component
@AllArgsConstructor
@Slf4j
public class BsxInventorySyncJob {

    private Env env;
    private BsxParser bsxParser;
    private BsxDocumentRepository bsxDocumentRepository;
    private BsxOrderRepository bsxOrderRepository;
    private BsxItemRepository bsxItemRepository;
    private TransactionTemplate transactionTemplate;

    @Scheduled(cron = "0 0 2 * * *")
    public void runJob() {
        runJobAsync();
    }

    @Async
    public void runJobAsync() {
        var filePath = env.getBsxInventoryFile();
        if (filePath == null || filePath.isBlank()) {
            log.info("BSX inventory sync skipped: BSX_INVENTORY_FILE not configured");
            return;
        }
        var path = Path.of(filePath);
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            log.warn("BSX inventory sync skipped: file not found {}", path);
            return;
        }
        transactionTemplate.executeWithoutResult(status -> importInventoryFile(path));
    }

    private void importInventoryFile(Path path) {
        var filename = path.getFileName().toString();
        bsxDocumentRepository.deleteByFilename(filename);
        bsxDocumentRepository.flush();

        var bsx = bsxParser.parse(path).orElse(null);
        if (bsx == null) {
            log.warn("BSX inventory sync failed: unable to parse {}", filename);
            return;
        }

        var document = new BsxDocument();
        document.setDocumentType("INVENTORY");
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

        if (bsx.getInventory() == null || bsx.getInventory().getItems() == null) {
            log.info("BSX inventory sync stored document {} with no items", filename);
            return;
        }

        var items = bsx.getInventory().getItems();
        if (items.isEmpty()) {
            log.info("BSX inventory sync stored document {} with empty inventory", filename);
            return;
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
        log.info("BSX inventory sync stored document {} with {} item(s)", filename, entities.size());
    }
}
