package com.vastbricks.shippinglabel;

import com.vastbricks.config.Env;
import com.vastbricks.market.link.Order;
import com.vastbricks.market.link.PrivateAPI;
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
class BricklinkShippingRequestService {
    private Env env;
    private MansPastsShippingApiClient mansPastsClient;

    ShippingLabelResult prepareShippingLabel(BricklinkShippingRequest request) {
        validateRequest(request);

        var order = new PrivateAPI(
                env.getBrickLinkConsumerKey(),
                env.getBrickLinkConsumerSecret(),
                env.getBrickLinkToken(),
                env.getBrickLinkTokenSecret()
        ).getOrder(request.getOrderId());

        if (order == null || order.getData() == null || order.getData().getShipping() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }

        var address = order.getData().getShipping().getAddress();
        if (address == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order shipping address not found");
        }

        var countryCode = StringUtils.upperCase(StringUtils.trimToEmpty(address.getCountryCode()));
        var mode = shippingMode(order);
        var packageRequest = buildPackageRequest(order, request.getWeight(), countryCode, mode);
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

    private void validateRequest(BricklinkShippingRequest request) {
        if (request == null || request.getOrderId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "orderId is required");
        }
        if (request.getWeight() == null || request.getWeight().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "weight is required");
        }
    }

    private MansPastsPackageRequest buildPackageRequest(Order order, BigDecimal weight, String countryCode, Tariff.Mode mode) {
        var data = order.getData();
        var address = data.getShipping().getAddress();
        return new MansPastsPackageRequest(
                "Goods",
                mode == Tariff.Mode.TRACEABLE ? "Tracked" : "Ordinary",
                "Letter",
                countryCode,
                join(address.getAddress1(), address.getAddress2()),
                join(address.getState(), address.getCity()),
                address.getPostalCode(),
                address.getName() != null ? address.getName().getFull() : address.getFull(),
                StringUtils.trimToNull(address.getPhoneNumber()),
                StringUtils.trimToNull(data.getBuyerEmail()),
                weight.setScale(3, RoundingMode.HALF_UP)
        );
    }

    private Tariff.Mode shippingMode(Order order) {
        var etc2 = order.getData().getCost() != null ? order.getData().getCost().getEtc2() : null;
        return etc2 != null && etc2.compareTo(BigDecimal.ZERO) > 0
                ? Tariff.Mode.TRACEABLE
                : Tariff.Mode.SIMPLE;
    }

    private String join(String ... strings) {
        return StringUtils.join(Arrays.stream(strings).filter(StringUtils::isNotBlank).distinct().toArray(), ", ");
    }
}
