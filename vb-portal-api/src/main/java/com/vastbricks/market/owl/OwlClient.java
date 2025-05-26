package com.vastbricks.market.owl;

import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@AllArgsConstructor
public class OwlClient {
    private static final String BASE_URL = "https://api.brickowl.com";
    private String key;
    private String cookie;

    public InternalAPI internal() {
        return new InternalAPI(cookie);
    }

    public CatalogAPI catalog() {
        return new CatalogAPI(BASE_URL, key);
    }
}
