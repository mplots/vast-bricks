package com.vastbricks.api.client.brickstore;

import java.time.LocalDate;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class BrickStoreOrderExportRequest {

    private final BrickStoreOrderType orderType;
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
    private final String useRealName = "y";

    @Builder.Default
    private final String includeMyCost = "Y";

    @Builder.Default
    private final String locType = "Y";

    @Builder.Default
    private final String locCountryId = "LV";

    private final String getOrders;

    private static BrickStoreOrderExportRequest create(
            BrickStoreOrderType orderType,
            LocalDate fromDate,
            LocalDate toDate,
            String orderId,
            boolean useRealName
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
        return BrickStoreOrderExportRequest.builder()
                .orderType(orderType)
                .fromDate(fromDate)
                .toDate(toDate)
                .orderId(orderId)
                .getOrders(fromDate == null ? null : "date")
                .useRealName(useRealName ? "y" : "n")
                .build();
    }

    public static BrickStoreOrderExportRequest all(BrickStoreOrderType orderType) {
        return create(orderType, null, null, null, true);
    }

    public static BrickStoreOrderExportRequest forDateRange(
            BrickStoreOrderType orderType,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        return create(orderType, fromDate, toDate, null, true);
    }

    public static BrickStoreOrderExportRequest forDateRange(
            BrickStoreOrderType orderType,
            LocalDate fromDate,
            LocalDate toDate,
            boolean useRealName
    ) {
        return create(orderType, fromDate, toDate, null, useRealName);
    }

    public static BrickStoreOrderExportRequest forOrderId(BrickStoreOrderType orderType, String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId is required");
        }
        return create(orderType, null, null, orderId, true);
    }

    public static BrickStoreOrderExportRequest forOrderIdInDateRange(
            BrickStoreOrderType orderType,
            String orderId,
            LocalDate fromDate,
            LocalDate toDate
    ) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("orderId is required");
        }
        return create(orderType, fromDate, toDate, orderId, true);
    }
}
