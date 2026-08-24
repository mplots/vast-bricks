package com.vastbricks.shippinglabel;

import java.math.BigDecimal;

record MansPastsPackageRequest(
        String type,
        String postageType,
        String itemType,
        String countryCode,
        String freeformAddressLine1,
        String freeformAddressLine2,
        String postCode,
        String name,
        String phone,
        String email,
        BigDecimal packageWeightKg,
        BigDecimal contentValue,
        BigDecimal postagePaid,
        String importerDetails,
        String relatedDocuments,
        String documentDescription,
        String documentNumber,
        String comment
) {
}
