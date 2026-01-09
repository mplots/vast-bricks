package com.vastbricks.service;

import com.vastbricks.bsx.BrickStoreXml;
import com.vastbricks.bsx.BsxParser;
import com.vastbricks.config.Env;
import com.vastbricks.jpa.entity.ProductPurchase;
import com.vastbricks.jpa.repository.ProductPurchaseRepository;
import com.vastbricks.jpa.repository.RebrickableInventoryRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@AllArgsConstructor
public class PurchaseProgressService {

    private final Env env;
    private final BsxParser bsxParser;
    private final RebrickableInventoryRepository rebrickableInventoryRepository;
    private final ProductPurchaseRepository productPurchaseRepository;

    public Map<Long, PurchaseProgress> buildProgress(List<ProductPurchaseRepository.PurchaseRow> purchases) {
        if (purchases == null || purchases.isEmpty()) {
            return Map.of();
        }

        var setNumbers = purchases.stream()
                .map(ProductPurchaseRepository.PurchaseRow::getSetNumber)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        var partsBySet = loadPartsBySet(setNumbers);
        var sales = loadOrderSales();

        var purchasesBySet = purchases.stream()
                .collect(Collectors.groupingBy(ProductPurchaseRepository.PurchaseRow::getSetNumber));

        var progressById = new HashMap<Long, PurchaseProgress>();

        for (var entry : purchasesBySet.entrySet()) {
            var setNumber = entry.getKey();
            if (setNumber == null) {
                continue;
            }
            var setParts = partsBySet.get(setNumber);
            var setPurchases = entry.getValue().stream()
                    .sorted(Comparator
                            .comparing(ProductPurchaseRepository.PurchaseRow::getPurchasedAt)
                            .thenComparing(ProductPurchaseRepository.PurchaseRow::getId))
                    .toList();

            if (setParts == null || setParts.partQuantities.isEmpty() || setParts.totalPartsPerSet <= 0) {
                for (var purchase : setPurchases) {
                    progressById.put(purchase.getId(), new PurchaseProgress(0, 0, 0));
                }
                continue;
            }

            var allocations = setPurchases.stream()
                    .map(purchase -> new PurchaseAllocation(
                            purchase.getId(),
                            purchase.getPurchasedAt(),
                            purchase.getQuantity() == null ? 0 : purchase.getQuantity()))
                    .toList();

            var allocationResult = allocateSales(setParts, allocations, sales);
            var soldParts = allocationResult.soldTotals();

            for (var purchase : setPurchases) {
                var totalParts = setParts.totalPartsPerSet * (purchase.getQuantity() == null ? 0 : purchase.getQuantity());
                var sold = soldParts.getOrDefault(purchase.getId(), 0);
                if (totalParts <= 0) {
                    progressById.put(purchase.getId(), new PurchaseProgress(0, 0, 0));
                    continue;
                }
                var percent = (int) Math.min(100, Math.round((sold * 100.0) / totalParts));
                progressById.put(purchase.getId(), new PurchaseProgress(sold, totalParts, percent));
            }
        }

        return progressById;
    }

    public PartBreakdown buildPartBreakdown(Long purchaseId, int offset, int limit) {
        if (purchaseId == null) {
            return new PartBreakdown(0, offset, limit, List.of());
        }
        var purchase = productPurchaseRepository.findById(purchaseId)
                .orElse(null);
        if (purchase == null || purchase.getBrickSet() == null) {
            return new PartBreakdown(0, offset, limit, List.of());
        }
        var setNumber = purchase.getBrickSet().getNumber();
        if (setNumber == null) {
            return new PartBreakdown(0, offset, limit, List.of());
        }

        var setParts = loadPartsBySet(Set.of(setNumber)).get(setNumber);
        if (setParts == null || setParts.partQuantities.isEmpty()) {
            return new PartBreakdown(0, offset, limit, List.of());
        }

        var purchasesForSet = productPurchaseRepository.findBySetNumberOrdered(setNumber);
        var allocations = purchasesForSet.stream()
                .map(p -> new PurchaseAllocation(
                        p.getId(),
                        p.getPurchasedAt(),
                        p.getQuantity() == null ? 0 : p.getQuantity()))
                .toList();

        var sales = loadOrderSales();
        var allocationResult = allocateSales(setParts, allocations, sales);
        var soldByPart = allocationResult.soldByPart()
                .getOrDefault(purchaseId, Map.of());

        var purchaseQty = purchase.getQuantity() == null ? 0 : purchase.getQuantity();
        var items = setParts.partQuantities.entrySet().stream()
                .map(entry -> {
                    var total = entry.getValue() * purchaseQty;
                    var sold = soldByPart.getOrDefault(entry.getKey(), 0);
                    var percent = total <= 0 ? 0 : (int) Math.min(100, Math.round((sold * 100.0) / total));
                    var colorName = setParts.colorNames.getOrDefault(entry.getKey().bricklinkColorId, "");
                    var partName = setParts.partNames.getOrDefault(entry.getKey().partNum, "");
                    var imageUrl = buildPartImageUrl(entry.getKey().partNum, entry.getKey().bricklinkColorId);
                    return new PartBreakdownItem(entry.getKey().partNum, partName, colorName, entry.getKey().bricklinkColorId, sold, total, percent, imageUrl);
                })
                .sorted(Comparator
                        .comparing(PartBreakdownItem::percent, Comparator.reverseOrder())
                        .thenComparing(Comparator.comparing(PartBreakdownItem::sold).reversed())
                        .thenComparing(PartBreakdownItem::partNum)
                        .thenComparing(PartBreakdownItem::colorId, Comparator.nullsLast(Integer::compareTo)))
                .toList();

        var totalCount = items.size();
        var safeOffset = Math.max(0, Math.min(offset, totalCount));
        var safeLimit = limit <= 0 ? 50 : Math.min(limit, 200);
        var paged = items.stream()
                .skip(safeOffset)
                .limit(safeLimit)
                .toList();

        return new PartBreakdown(totalCount, safeOffset, safeLimit, paged);
    }

    private Map<Long, SetParts> loadPartsBySet(Collection<Long> setNumbers) {
        var result = new HashMap<Long, SetParts>();
        if (setNumbers == null || setNumbers.isEmpty()) {
            return result;
        }

        var requested = setNumbers.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (requested.isEmpty()) {
            return result;
        }

        var setNumVariants = requested.stream()
                .flatMap(setNumber -> Set.of(setNumber.toString(), setNumber + "-1").stream())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));

        var rows = rebrickableInventoryRepository.findLatestInventoryParts(new ArrayList<>(setNumVariants));

        var builders = new HashMap<Long, SetPartsBuilder>();
        for (var row : rows) {
            if (row.getPartNum() == null || row.getQuantity() == null || row.getQuantity() <= 0) {
                continue;
            }
            var parsedSet = parseSetNumber(row.getSetNum());
            if (parsedSet == null || !requested.contains(parsedSet)) {
                continue;
            }
            var bricklinkColorId = row.getBricklinkColorId();
            if (bricklinkColorId == null) {
                continue;
            }
            var key = new PartKey(row.getPartNum().trim(), bricklinkColorId);
            var builder = builders.computeIfAbsent(parsedSet, ignored -> new SetPartsBuilder());
            builder.partQuantities.merge(key, row.getQuantity(), Integer::sum);
            builder.totalParts += row.getQuantity();
            if (row.getColorName() != null && !row.getColorName().isBlank()) {
                builder.colorNames.put(bricklinkColorId, row.getColorName().trim());
            }
            if (row.getPartName() != null && !row.getPartName().isBlank()) {
                builder.partNames.put(row.getPartNum().trim(), row.getPartName().trim());
            }
        }

        for (var setNumber : requested) {
            var builder = builders.get(setNumber);
            if (builder == null) {
                result.put(setNumber, new SetParts(Map.of(), Map.of(), Map.of(), 0));
            } else {
                result.put(setNumber, new SetParts(builder.partQuantities, builder.colorNames, builder.partNames, builder.totalParts));
            }
        }

        return result;
    }

    private Long parseSetNumber(String rawSetNum) {
        if (rawSetNum == null || rawSetNum.isBlank()) {
            return null;
        }
        var trimmed = rawSetNum.trim();
        var dashIndex = trimmed.indexOf('-');
        var base = dashIndex > 0 ? trimmed.substring(0, dashIndex) : trimmed;
        try {
            return Long.parseLong(base);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private List<OrderItemSale> loadOrderSales() {
        var bsxDir = env.getBsxOrderDir();
        if (bsxDir == null || bsxDir.isBlank()) {
            return List.of();
        }
        var dirPath = Path.of(bsxDir);
        if (!Files.exists(dirPath) || !Files.isDirectory(dirPath)) {
            return List.of();
        }

        var results = new ArrayList<OrderItemSale>();
        try (var stream = Files.list(dirPath)) {
            var files = stream
                    .filter(path -> path.getFileName().toString().toLowerCase().endsWith(".bsx"))
                    .toList();
            for (var path : files) {
                var bsx = bsxParser.parse(path).orElse(null);
                if (bsx == null) {
                    continue;
                }
                results.addAll(extractSales(bsx));
            }
        } catch (Exception ignored) {
            return List.of();
        }

        return results;
    }

    private List<OrderItemSale> extractSales(BrickStoreXml bsx) {
        if (bsx.getOrder() == null || bsx.getInventory() == null || bsx.getInventory().getItems() == null) {
            return List.of();
        }
        var orderDate = toOrderDate(bsx.getOrder().getOrderDate());
        if (orderDate == null) {
            return List.of();
        }
        var results = new ArrayList<OrderItemSale>();
        for (var item : bsx.getInventory().getItems()) {
            if (item == null || item.getItemId() == null || item.getQty() == null) {
                continue;
            }
            if (item.getItemTypeId() == null || !"P".equalsIgnoreCase(item.getItemTypeId().trim())) {
                continue;
            }
            var partId = item.getItemId().trim();
            var colorId = item.getColorId();
            if (partId.isEmpty() || item.getQty() <= 0 || colorId == null) {
                continue;
            }
            results.add(new OrderItemSale(orderDate, new PartKey(partId, colorId), item.getQty()));
        }
        return results;
    }

    private LocalDate toOrderDate(Long rawOrderDate) {
        if (rawOrderDate == null) {
            return null;
        }
        long epoch = rawOrderDate;
        if (epoch > 9999999999L) {
            return Instant.ofEpochMilli(epoch).atZone(ZoneId.systemDefault()).toLocalDate();
        }
        return Instant.ofEpochSecond(epoch).atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private AllocationResult allocateSales(SetParts setParts, List<PurchaseAllocation> allocations, List<OrderItemSale> sales) {
        var soldTotals = new HashMap<Long, Integer>();
        var soldByPart = new HashMap<Long, Map<PartKey, Integer>>();
        for (var allocation : allocations) {
            soldTotals.put(allocation.purchaseId, 0);
            soldByPart.put(allocation.purchaseId, new HashMap<>());
        }

        var salesForSet = sales.stream()
                .filter(sale -> setParts.partQuantities.containsKey(sale.partKey))
                .toList();
        if (salesForSet.isEmpty()) {
            return new AllocationResult(soldTotals, soldByPart);
        }

        var salesByPart = salesForSet.stream()
                .collect(Collectors.groupingBy(sale -> sale.partKey, LinkedHashMap::new, Collectors.toList()));

        for (var partEntry : salesByPart.entrySet()) {
            var partKey = partEntry.getKey();
            var perSetQty = setParts.partQuantities.get(partKey);
            if (perSetQty == null || perSetQty <= 0) {
                continue;
            }

            var remainingPerPurchase = new int[allocations.size()];
            for (int i = 0; i < allocations.size(); i++) {
                remainingPerPurchase[i] = perSetQty * allocations.get(i).quantity;
            }

            var partSales = partEntry.getValue().stream()
                    .filter(sale -> sale.orderDate != null)
                    .sorted(Comparator.comparing(sale -> sale.orderDate))
                    .toList();

            for (var sale : partSales) {
                var remainingSaleQty = sale.qty;
                for (int i = 0; i < allocations.size(); i++) {
                    if (remainingSaleQty <= 0) {
                        break;
                    }
                    var allocation = allocations.get(i);
                    if (allocation.purchasedAt == null || sale.orderDate.isBefore(allocation.purchasedAt)) {
                        break;
                    }
                    if (remainingPerPurchase[i] <= 0) {
                        continue;
                    }
                    var applied = Math.min(remainingPerPurchase[i], remainingSaleQty);
                    remainingPerPurchase[i] -= applied;
                    remainingSaleQty -= applied;
                    soldTotals.merge(allocation.purchaseId, applied, Integer::sum);
                    soldByPart.computeIfAbsent(allocation.purchaseId, ignored -> new HashMap<>())
                            .merge(partKey, applied, Integer::sum);
                }
            }
        }

        return new AllocationResult(soldTotals, soldByPart);
    }

    private record OrderItemSale(LocalDate orderDate, PartKey partKey, int qty) { }

    private record PartKey(String partNum, Integer bricklinkColorId) { }

    private record SetParts(Map<PartKey, Integer> partQuantities,
                            Map<Integer, String> colorNames,
                            Map<String, String> partNames,
                            int totalPartsPerSet) { }

    private record PurchaseAllocation(Long purchaseId, LocalDate purchasedAt, int quantity) { }

    private static class SetPartsBuilder {
        private final Map<PartKey, Integer> partQuantities = new HashMap<>();
        private final Map<Integer, String> colorNames = new HashMap<>();
        private final Map<String, String> partNames = new HashMap<>();
        private int totalParts = 0;
    }

    public record PurchaseProgress(int soldParts, int totalParts, int percent) { }

    public record PartBreakdown(int total, int offset, int limit, List<PartBreakdownItem> items) { }

    public record PartBreakdownItem(String partNum,
                                    String partName,
                                    String colorName,
                                    Integer colorId,
                                    int sold,
                                    int total,
                                    int percent,
                                    String imageUrl) { }

    private record AllocationResult(Map<Long, Integer> soldTotals,
                                    Map<Long, Map<PartKey, Integer>> soldByPart) { }

    private String buildPartImageUrl(String partNum, Integer colorId) {
        if (partNum == null || partNum.isBlank()) {
            return null;
        }
        var color = colorId == null ? "0" : colorId.toString();
        return "https://img.bricklink.com/ItemImage/PN/%s/%s.png".formatted(color, partNum.trim());
    }

}
