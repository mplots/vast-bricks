package com.vastbricks.market.link;

import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@AllArgsConstructor
public class LinkClient {

    private String cookie;

    public PublicWebAPI publicWeb() {
        return new PublicWebAPI();
    }

    public InternalAPI internal() {
        return new InternalAPI(cookie);
    }
}
