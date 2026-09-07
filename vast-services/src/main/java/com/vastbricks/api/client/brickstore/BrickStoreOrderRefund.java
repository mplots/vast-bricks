package com.vastbricks.api.client.brickstore;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * What the BrickLink order detail page states was refunded on one order, as its "Total refunded" line.
 *
 * <p>The export names no refund at all, so this is the only place BrickLink reports one.
 */
@Data
@AllArgsConstructor
public class BrickStoreOrderRefund {

    private final String currency;

    private final BigDecimal amount;
}
