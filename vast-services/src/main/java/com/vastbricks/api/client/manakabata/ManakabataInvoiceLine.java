package com.vastbricks.api.client.manakabata;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.math.BigDecimal;
import lombok.Builder;
import lombok.Data;

/** One line of an invoice. Declared by hand for the same reason as {@link ManakabataInvoiceRequest}. */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ManakabataInvoiceLine {
    private String name;
    private String measurement;
    private BigDecimal quantity;
    /** Price without VAT. */
    private BigDecimal price;
    private String discountType;
    private String category;
    private String code;
    private BigDecimal discount;
    /** VAT percent. */
    private BigDecimal tax;
}
