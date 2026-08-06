package com.vastbricks.integration.bricklink;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.util.Objects;

@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class OrderExportRequest {
    private final OrderType orderType;
    private final LocalDate fromDate;
    private final LocalDate toDate;
    private final String orderId;
    @Builder.Default
    private final String action = "save";
    @Builder.Default
    private final String viewType = "X";
    @Builder.Default
    private final String getStatusSel = "I";
    @Builder.Default
    private final String getFiled = "Y";
    @Builder.Default
    private final String getDetail = "y";
    @Builder.Default
    private final String getDateFormat = "0";
    @Builder.Default
    private final String includeMyCost = "Y";
    private final String getOrders;

    private static OrderExportRequest create(
            OrderType orderType,
            LocalDate fromDate,
            LocalDate toDate,
            String orderId
    ) {
        Objects.requireNonNull(orderType, "orderType");
        orderId = orderId == null ? null : orderId.trim();
        orderId = orderId != null && orderId.isEmpty() ? null : orderId;

        if ((fromDate == null) != (toDate == null)) {
            throw new IllegalArgumentException("Both fromDate and toDate are required for a date range");
        }
        if (fromDate != null && fromDate.isAfter(toDate)) {
            throw new IllegalArgumentException("fromDate must not be after toDate");
        }
        if (orderId != null && fromDate != null) {
            throw new IllegalArgumentException("Use either orderId or a date range, not both");
        }
        return OrderExportRequest.builder()
                .orderType(orderType)
                .fromDate(fromDate)
                .toDate(toDate)
                .orderId(orderId)
                .getOrders(fromDate == null ? null : "date")
                .build();
    }

    public static OrderExportRequest all(OrderType orderType) {
        return create(orderType, null, null, null);
    }

    public static OrderExportRequest forDateRange(OrderType orderType, LocalDate fromDate, LocalDate toDate) {
        return create(orderType, fromDate, toDate, null);
    }

    public static OrderExportRequest forOrderId(OrderType orderType, String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId is required");
        }
        return create(orderType, null, null, orderId);
    }
}
