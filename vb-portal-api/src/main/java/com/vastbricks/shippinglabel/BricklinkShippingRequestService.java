package com.vastbricks.shippinglabel;

import com.vastbricks.config.Env;
import com.vastbricks.jpa.entity.Marketplace;
import com.vastbricks.market.link.Order;
import com.vastbricks.market.link.PrivateAPI;
import com.vastbricks.shipping.Tariff;
import com.vastbricks.taxinvoice.TaxInvoiceParseResult;
import com.vastbricks.taxinvoice.TaxInvoiceParseRequest;
import com.vastbricks.taxinvoice.TaxInvoiceParserException;
import com.vastbricks.taxinvoice.TaxInvoiceParserService;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;

@Service
@AllArgsConstructor
@Slf4j
class BricklinkShippingRequestService {
    private Env env;
    private MansPastsShippingApiClient mansPastsClient;
    private TaxInvoiceParserService taxInvoiceParserService;

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

        var countryCode = MansPastsShippingApiClient.normalizeCountryCode(address.getCountryCode());
        var mode = shippingMode(order);
        var taxInvoice = parseVatInvoice(request, countryCode);
        var packageRequest = buildPackageRequest(order, request.getWeight(), countryCode, mode, taxInvoice);
        archiveVatInvoice(request, order, taxInvoice);
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
        if (request.getVatInvoicePdf() != null || StringUtils.isNotBlank(request.getVatInvoiceFilename())) {
            if (request.getVatInvoicePdf() == null || request.getVatInvoicePdf().length == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "VAT invoice PDF is required");
            }
            if (StringUtils.isBlank(request.getVatInvoiceFilename())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "VAT invoice filename is required");
            }
        }
    }

    private void archiveVatInvoice(BricklinkShippingRequest request, Order order, TaxInvoiceParseResult taxInvoice) {
        if (request.getVatInvoicePdf() == null || request.getVatInvoicePdf().length == 0) {
            return;
        }

        log.info(
            "Parsed BrickLink tax invoice for order {}: invoice {}, tax ID {}",
            order.getData().getOrderId(),
            taxInvoice.invoiceNumber(),
            taxInvoice.taxId()
        );

        var dateStatusChanged = order.getData().getDateStatusChanged();
        if (dateStatusChanged == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Order status change date is not available");
        }

        try {
            var archiveDirectory = archiveDirectory();
            Files.createDirectories(archiveDirectory);
            var path = archiveDirectory.resolve(
                "vat-invoice-" + order.getData().getOrderId() + "-" + safeFilenamePart(dateStatusChanged.toString()) + ".pdf"
            );
            if (!Files.exists(path)) {
                Files.write(path, request.getVatInvoicePdf(), StandardOpenOption.CREATE_NEW);
            }
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not archive VAT invoice", ex);
        }
    }

    private TaxInvoiceParseResult parseVatInvoice(BricklinkShippingRequest request, String countryCode) {
        if (request.getVatInvoicePdf() == null || request.getVatInvoicePdf().length == 0) {
            return null;
        }
        try {
            return taxInvoiceParserService.parse(
                Marketplace.BRICK_LINK,
                countryCode,
                new TaxInvoiceParseRequest(
                    request.getVatInvoicePdf(),
                    request.getVatInvoiceFilename(),
                    request.getOrderId()
                )
            );
        } catch (TaxInvoiceParserException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }
    }

    private Path archiveDirectory() {
        if (StringUtils.isBlank(env.getBrickLinkOrderArchiveDir())) {
            throw new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "BRICKLINK_ORDER_ARCHIVE_DIR is not configured"
            );
        }
        return Path.of(env.getBrickLinkOrderArchiveDir().trim());
    }

    private String safeFilenamePart(String value) {
        return value.trim().replaceAll("[^A-Za-z0-9._:+-]", "-");
    }

    private MansPastsPackageRequest buildPackageRequest(
        Order order,
        BigDecimal weight,
        String countryCode,
        Tariff.Mode mode,
        TaxInvoiceParseResult taxInvoice
    ) {
        var data = order.getData();
        var address = data.getShipping().getAddress();
        var cost = data.getCost();
        var contentValue = cost == null ? null : amountWithAdditional(cost.getSubtotal(), cost.getEtc1());
        var postagePaid = cost == null ? null : amountWithAdditional(cost.getShipping(), cost.getEtc2());
        validateCustomsAmounts(countryCode, contentValue, postagePaid);
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
                weight.setScale(3, RoundingMode.HALF_UP),
                scaleMoney(contentValue),
                scaleMoney(postagePaid),
                taxInvoice == null ? null : taxInvoice.taxId(),
                taxInvoice == null ? null : "invoice",
                taxInvoice == null ? null : "BrickLink Invoice",
                taxInvoice == null ? null : taxInvoice.invoiceNumber(),
                "Order #" + data.getOrderId()
        );
    }

    static BigDecimal amountWithAdditional(BigDecimal base, BigDecimal additional) {
        return base == null ? null : base.add(additional == null ? BigDecimal.ZERO : additional);
    }

    private BigDecimal scaleMoney(BigDecimal amount) {
        return amount == null ? null : amount.setScale(2, RoundingMode.HALF_UP);
    }

    private void validateCustomsAmounts(String countryCode, BigDecimal contentValue, BigDecimal postagePaid) {
        if (!MansPastsShippingApiClient.isEuCountry(countryCode) && (contentValue == null || postagePaid == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Order customs values are not available");
        }
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
