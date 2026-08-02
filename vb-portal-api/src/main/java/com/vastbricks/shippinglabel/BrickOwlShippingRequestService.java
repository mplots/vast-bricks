package com.vastbricks.shippinglabel;

import com.vastbricks.config.Env;
import com.vastbricks.market.owl.OrderView;
import com.vastbricks.market.owl.OwlClient;
import com.vastbricks.shipping.Tariff;
import lombok.AllArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;

@Service
@AllArgsConstructor
class BrickOwlShippingRequestService {
    private Env env;
    private MansPastsShippingApiClient mansPastsClient;

    ShippingLabelResult prepareShippingLabel(BrickOwlShippingRequest request) {
        validateRequest(request);
        if (StringUtils.isBlank(env.getBrickOwlApiKey())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Brick Owl API key is not configured");
        }

        var order = new OwlClient(env.getBrickOwlApiKey(), env.getBrickOwlCookie())
                .order()
                .view(StringUtils.trim(request.getOrderId()));
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Brick Owl order not found");
        }
        if (!StringUtils.startsWithIgnoreCase(StringUtils.trimToEmpty(order.getShipMethodName()), "Latvian Post")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order shipping method is not Latvian Post");
        }

        var packageRequest = buildPackageRequest(order, request);
        try {
            var label = mansPastsClient.createPackageAndDownloadDocument(packageRequest);
            return new ShippingLabelResult(
                    label.pdf(),
                    label.packageId(),
                    label.barcode()
            );
        } catch (MansPastsShippingApiException ex) {
            throw new ResponseStatusException(
                    ex.getStatusCode() != null ? ex.getStatusCode() : HttpStatus.BAD_GATEWAY,
                    ex.getMessage(),
                    ex
            );
        }
    }

    private void validateRequest(BrickOwlShippingRequest request) {
        if (request == null || StringUtils.isBlank(request.getOrderId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "orderId is required");
        }
        if (request.getWeight() != null && request.getWeight().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weight must be positive");
        }
    }

    private MansPastsPackageRequest buildPackageRequest(OrderView order, BrickOwlShippingRequest request) {
        var weight = request.getWeight() != null ? request.getWeight() : order.getWeight();
        if (weight == null || weight.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weight is required");
        }

        var mode = shippingMode(order);
        return new MansPastsPackageRequest(
                "Goods",
                mode == Tariff.Mode.TRACEABLE ? "Tracked" : "Ordinary",
                "Letter",
                StringUtils.upperCase(StringUtils.trimToNull(order.getShipCountryCode())),
                join(order.getShipStreet1(), order.getShipStreet2()),
                join(order.getShipRegion(), order.getShipCity()),
                StringUtils.trimToNull(order.getShipPostCode()),
                fullName(order),
                StringUtils.trimToNull(order.getShipPhone()),
                StringUtils.trimToNull(order.getCustomerEmail()),
                weight.setScale(3, RoundingMode.HALF_UP),
                "Order #" + StringUtils.trim(request.getOrderId())
        );
    }

    private Tariff.Mode shippingMode(OrderView order) {
        return StringUtils.containsIgnoreCase(order.getShipMethodName(), "Traceable")
                ? Tariff.Mode.TRACEABLE
                : Tariff.Mode.SIMPLE;
    }

    private String fullName(OrderView order) {
        var name = join(order.getShipFirstName(), order.getShipLastName());
        return StringUtils.defaultIfBlank(name, order.getBuyerName());
    }

    private String join(String... values) {
        return StringUtils.trimToNull(StringUtils.join(
                Arrays.stream(values)
                        .filter(StringUtils::isNotBlank)
                        .map(StringUtils::trim)
                        .distinct()
                        .toArray(),
                ", "
        ));
    }
}
