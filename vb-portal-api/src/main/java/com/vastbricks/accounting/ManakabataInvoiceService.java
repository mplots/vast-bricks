package com.vastbricks.accounting;

import com.vastbricks.config.Env;
import com.vastbricks.integration.bricklink.LinkAPIClient;
import com.vastbricks.integration.bricklink.LinkOrder;
import com.vastbricks.integration.manakabata.ManakabataClientGateway;
import com.vastbricks.integration.manakabata.ManakabataInvoiceGateway;
import com.vastbricks.integration.manakabata.ManakabataInvoiceRequest;
import com.vastbricks.integration.manakabata.ManakabataUuidReference;
import com.vastbricks.api.client.manakabata.model.ClientResource;
import com.vastbricks.api.client.manakabata.model.InvoiceResource;
import com.vastbricks.api.client.manakabata.model.PersonTypeEnum;
import com.vastbricks.api.client.manakabata.model.StoreClientRequest;
import com.vastbricks.market.owl.OrderView;
import com.vastbricks.market.owl.OwlClient;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.function.Function;

@Service
public class ManakabataInvoiceService {
    private static final String BRICK_LINK = "bricklink";
    private static final String BRICK_OWL = "brickowl";

    private final Function<Long, LinkOrder> brickLinkOrder;
    private final Function<String, OrderView> brickOwlOrder;
    private final Function<StoreClientRequest, ClientResource> upsertClient;
    private final Function<ManakabataInvoiceRequest, InvoiceResource> createInvoice;
    private final String invoiceNumeratorUuid;
    private final String teamBankAccountUuid;

    @Autowired
    public ManakabataInvoiceService(
        LinkAPIClient linkApiClient,
        Env env,
        ManakabataClientGateway manakabataClientGateway,
        ManakabataInvoiceGateway manakabataInvoiceGateway
    ) {
        this(
            orderId -> {
                var response = linkApiClient.getOrder(orderId);
                return response == null ? null : response.getData();
            },
            orderId -> new OwlClient(env.getBrickOwlApiKey(), env.getBrickOwlCookie()).order().view(orderId),
            manakabataClientGateway::upsertClient,
            manakabataInvoiceGateway::createInvoice,
            env.getManakabataInvoiceNumeratorUuid(),
            env.getManakabataTeamBankAccountUuid()
        );
    }

    ManakabataInvoiceService(
        Function<Long, LinkOrder> brickLinkOrder,
        Function<String, OrderView> brickOwlOrder,
        Function<StoreClientRequest, ClientResource> upsertClient,
        Function<ManakabataInvoiceRequest, InvoiceResource> createInvoice,
        String invoiceNumeratorUuid,
        String teamBankAccountUuid
    ) {
        this.brickLinkOrder = brickLinkOrder;
        this.brickOwlOrder = brickOwlOrder;
        this.upsertClient = upsertClient;
        this.createInvoice = createInvoice;
        this.invoiceNumeratorUuid = invoiceNumeratorUuid;
        this.teamBankAccountUuid = teamBankAccountUuid;
    }

    public GenerateInvoiceResult generateInvoice(String orderId, String source) {
        if (StringUtils.isBlank(orderId)) {
            throw new IllegalArgumentException("orderId is required");
        }

        var normalizedSource = normalizeSource(source);
        var order = switch (normalizedSource) {
            case BRICK_LINK -> brickLinkOrder(orderId.trim());
            case BRICK_OWL -> brickOwlOrder(orderId.trim());
            default -> throw new IllegalArgumentException("Unsupported order source: " + source);
        };
        var client = upsertClient.apply(order.getClientRequest());
        var invoice = createInvoice.apply(invoiceRequest(client.getUuid(), order.getOrderDate()));
        return new GenerateInvoiceResult(
            invoice.getUuid(),
            invoice.getInvoiceNumber(),
            client.getUuid(),
            order.getClientRequest().getReferenceId(),
            order.getClientRequest().getName()
        );
    }

    private InvoiceOrder brickLinkOrder(String orderId) {
        final long numericOrderId;
        try {
            numericOrderId = Long.parseLong(orderId);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("BrickLink orderId must be numeric", ex);
        }

        var order = brickLinkOrder.apply(numericOrderId);
        if (order == null) {
            throw new IllegalArgumentException("BrickLink order not found: " + orderId);
        }
        var buyerReference = required(order.getBuyerName(), "BrickLink order has no buyer identifier");
        var customerName = buyerReference;
        if (order.getShipping() != null && order.getShipping().getAddress() != null) {
            var address = order.getShipping().getAddress();
            if (address.getName() != null) {
                customerName = firstNotBlank(address.getName().getFull(), customerName);
            }
        }
        return new InvoiceOrder(
            clientRequest("bricklink:customer:" + buyerReference, customerName),
            parseDate(order.getDateOrdered(), "BrickLink order has no valid order date")
        );
    }

    private InvoiceOrder brickOwlOrder(String orderId) {
        var order = brickOwlOrder.apply(orderId);
        if (order == null) {
            throw new IllegalArgumentException("Brick Owl order not found: " + orderId);
        }
        var buyerReference = required(
            firstNotBlank(order.getCustomerUserId(), order.getCustomerUsername()),
            "Brick Owl order has no customer identifier"
        );
        var customerName = firstNotBlank(
            fullName(order.getBillingFirstName(), order.getBillingLastName()),
            fullName(order.getShipFirstName(), order.getShipLastName()),
            order.getBuyerName(),
            order.getCustomerUsername()
        );
        var orderDateTime = order.getIsoOrderTime() != null ? order.getIsoOrderTime() : order.getOrderTime();
        if (orderDateTime == null) {
            throw new IllegalArgumentException("Brick Owl order has no order date");
        }
        return new InvoiceOrder(
            clientRequest(
                "brickowl:customer:" + buyerReference,
                required(customerName, "Brick Owl order has no customer name")
            ),
            orderDateTime.toLocalDate()
        );
    }

    private ManakabataInvoiceRequest invoiceRequest(String clientUuid, LocalDate orderDate) {
        return ManakabataInvoiceRequest.builder()
            .invoiceCategory("product")
            .invoiceType("bill_of_landing")
            .recipientSelectionMode("existing")
            .recipient(new ManakabataUuidReference(clientUuid))
            .payerIsRecipient(true)
            .invoicedAt(orderDate)
            .invoiceLocale("en")
            .currency("EUR")
            .showCode(true)
            .showDiscount(true)
            .publicLink(true)
            .invoiceNumeratorSelectionMode("existing")
            .invoiceNumerator(new ManakabataUuidReference(required(
                invoiceNumeratorUuid,
                "MANAKABATA_INVOICE_NUMERATOR_UUID is required"
            )))
            .teamBankAccountSelectionMode("existing")
            .teamBankAccount(new ManakabataUuidReference(required(
                teamBankAccountUuid,
                "MANAKABATA_TEAM_BANK_ACCOUNT_UUID is required"
            )))
            .build();
    }

    private StoreClientRequest clientRequest(String referenceId, String name) {
        return new StoreClientRequest()
            .type(PersonTypeEnum.PERSON)
            .name(name)
            .referenceId(referenceId)
            .isSelfEmployed(false)
            .isVatSpecial(false)
            .isSyncEnabled(false)
            ;
    }

    private String normalizeSource(String source) {
        if (StringUtils.isBlank(source)) {
            throw new IllegalArgumentException("source is required");
        }
        return source.trim().toLowerCase(Locale.ROOT).replace(" ", "").replace("_", "");
    }

    private LocalDate parseDate(String value, String message) {
        if (StringUtils.isBlank(value) || value.length() < 10) {
            throw new IllegalArgumentException(message);
        }
        try {
            return LocalDate.parse(value.substring(0, 10));
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(message, ex);
        }
    }

    private String fullName(String firstName, String lastName) {
        return StringUtils.trimToNull(String.join(
            " ",
            StringUtils.defaultString(firstName).trim(),
            StringUtils.defaultString(lastName).trim()
        ));
    }

    private String firstNotBlank(String... values) {
        for (var value : values) {
            if (StringUtils.isNotBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private String required(String value, String message) {
        if (StringUtils.isBlank(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    @lombok.Getter
    @lombok.AllArgsConstructor
    private static class InvoiceOrder {
        private StoreClientRequest clientRequest;
        private LocalDate orderDate;
    }
}
