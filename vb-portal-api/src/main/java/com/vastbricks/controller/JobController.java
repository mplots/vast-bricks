package com.vastbricks.controller;

import com.vastbricks.job.CatalogSynchronizationJob;
import com.vastbricks.job.PartOutValueJob;
import com.vastbricks.job.WebStoreScraperJob;
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
    private PartOutValueJob partOutValueJob;

    @GetMapping("trigger-web-store-scraper-job")
    public String triggerWebStoreScraperJob(@RequestParam(value = "stores", required = false) List<String> stores) {
        if (stores == null) {
            webStoreScraperJob.runJobAsync();
        } else {
            webStoreScraperJob.runJobAsync(stores);
        }
        return "ok";
    }

    @GetMapping("trigger-catalog-synchronization-job")
    public String triggerCatalogSynchronizationJob() {
        catalogSynchronizationJob.runJobAsync();
        return "ok";
    }

    @GetMapping("trigger-part-out-value-job")
    public String triggerPartOutValueJob() {
        partOutValueJob.runJobAsync();
        return "ok";
    }
}
