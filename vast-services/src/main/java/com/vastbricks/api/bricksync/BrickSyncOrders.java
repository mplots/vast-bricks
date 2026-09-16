package com.vastbricks.api.bricksync;

import com.vastbricks.api.orderarchive.OrderSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Which orders BrickSync has synchronized between the store's marketplaces.
 *
 * <p>BrickSync writes one file an order into its {@code orders} directory, named {@code marketplace-orderId.bsx}: the
 * inventory it took out of the store for that order, kept so the order can be replayed. The file existing is the
 * whole of what this reads - nothing opens it - because the question being asked of it is whether BrickSync ever saw
 * the order at all.
 *
 * <p>This is the feature's whole public API. What a synchronization is worth, and what a missing one means, belongs
 * to whoever is asking; this says only what is on disk.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BrickSyncOrders {

    private static final String SUFFIX = ".bsx";

    private final BrickSyncSettings settings;

    /**
     * Every order BrickSync holds a file for, as {@code marketplace-orderId} with the marketplace spelled the way
     * the order archive spells it, so a caller matches on one vocabulary rather than on BrickSync's file names.
     *
     * <p>A directory that is not there holds nothing, and says so rather than failing: a store that does not run
     * BrickSync, or one whose orders have not been copied down, is not a store whose report should not load.
     */
    public Set<String> synchronizedOrderKeys() {
        Path directory = ordersDirectory();
        if (!Files.isDirectory(directory)) {
            log.debug("BrickSync holds no orders directory at {}", directory);
            return Set.of();
        }
        try (Stream<Path> files = Files.list(directory)) {
            var keys = new HashSet<String>();
            files.map(file -> file.getFileName().toString())
                    .filter(name -> name.endsWith(SUFFIX))
                    .map(name -> name.substring(0, name.length() - SUFFIX.length()))
                    .forEach(name -> add(keys, name));
            return Set.copyOf(keys);
        } catch (IOException exception) {
            throw new BrickSyncException("Could not read BrickSync's orders at " + directory, exception);
        }
    }

    /** The key one file states, or nothing where the name is not a marketplace and an order id. */
    private static void add(Set<String> keys, String name) {
        int split = name.indexOf('-');
        if (split <= 0 || split == name.length() - 1) {
            return;
        }
        OrderSource marketplace = marketplaceOf(name.substring(0, split));
        if (marketplace != null) {
            keys.add(key(marketplace, name.substring(split + 1)));
        }
    }

    /** How a caller names one order of one marketplace, which is what {@link #synchronizedOrderKeys()} answers in. */
    public static String key(OrderSource marketplace, String orderId) {
        return marketplace.prefix() + "-" + orderId;
    }

    /**
     * The marketplace a file name starts with, or null for a file BrickSync wrote for something else. BrickSync
     * spells both marketplaces exactly as the archive does, which is why the two can share one vocabulary.
     */
    private static OrderSource marketplaceOf(String prefix) {
        for (OrderSource marketplace : OrderSource.values()) {
            if (marketplace.prefix().equals(prefix.toLowerCase(Locale.ROOT))) {
                return marketplace;
            }
        }
        return null;
    }

    private Path ordersDirectory() {
        String configured = settings.getOrdersDirectory();
        if (configured == null || configured.isBlank()) {
            throw new BrickSyncException("VAST_BRICKSYNC_ORDERS_DIR is not configured");
        }
        return Path.of(configured.trim());
    }
}
