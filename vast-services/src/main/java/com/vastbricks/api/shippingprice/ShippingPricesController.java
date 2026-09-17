package com.vastbricks.api.shippingprice;

import com.vastbricks.api.shippingprice.ShippingPricePayload.CountryPricesResponse;
import com.vastbricks.api.shippingprice.ShippingPricePayload.CountryResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value = "/api/private/shipping-prices", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class ShippingPricesController {

    private final ShippingPriceService shippingPriceService;

    /** The destinations there are prices for, which is what the screen's selector is filled from. */
    @GetMapping("/countries")
    List<CountryResponse> listCountries() {
        return shippingPriceService.findCountries();
    }

    /** One destination's tariff. */
    @GetMapping
    CountryPricesResponse listPrices(@RequestParam("country") String country) {
        if (country == null || country.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "country must be stated");
        }
        return shippingPriceService.findPrices(country.trim());
    }
}
