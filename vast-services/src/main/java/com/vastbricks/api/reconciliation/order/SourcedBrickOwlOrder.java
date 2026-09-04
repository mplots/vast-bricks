package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickowl.BrickOwlOrderItem;
import java.time.LocalDate;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** One BrickOwl order: its detail, its items, and the date only the order list response always carries. */
@Getter
@AllArgsConstructor
class SourcedBrickOwlOrder {

    private final BrickOwlOrder order;
    private final List<BrickOwlOrderItem> items;
    private final LocalDate orderDate;
}
