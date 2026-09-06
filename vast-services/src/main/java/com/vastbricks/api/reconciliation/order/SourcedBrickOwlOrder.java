package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** One BrickOwl order: its detail and the date only the order list response always carries. */
@Getter
@AllArgsConstructor
class SourcedBrickOwlOrder {

    private final BrickOwlOrder order;
    private final LocalDate orderDate;
}
