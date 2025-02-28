package com.vastbricks.controller;

import com.vastbricks.job.CatalogSynchronizationJob;
import com.vastbricks.job.WebStoreScraperJob;
import com.vastbricks.jpa.entity.WebStore;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("jobs")
@AllArgsConstructor
@Slf4j
public class JobController {

    private WebStoreScraperJob webStoreScraperJob;
    private CatalogSynchronizationJob catalogSynchronizationJob;

    @GetMapping("trigger-web-store-scraper-job")
    public String triggerWebStoreScraperJob(@RequestParam(value = "stores", required = false) List<WebStore> stores) {
        stores = stores == null ? List.of(WebStore.values()) : stores;
        webStoreScraperJob.runJobAsync(stores);
        return "ok";
    }

    @GetMapping("trigger-catalog-synchronization-job")
    public String triggerCatalogSynchronizationJob() {
        catalogSynchronizationJob.runJobAsync();
        return "ok";
    }
}
