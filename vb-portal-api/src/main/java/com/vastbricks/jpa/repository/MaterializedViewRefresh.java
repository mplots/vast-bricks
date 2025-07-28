package com.vastbricks.jpa.repository;

import lombok.AllArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@AllArgsConstructor
public class MaterializedViewRefresh {

    private final JdbcTemplate jdbcTemplate;

    public void refreshCheapestOfferView() {
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY cheapest_offer_per_set");
    }
}
