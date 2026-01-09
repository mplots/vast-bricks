package com.vastbricks.controller;

import com.vastbricks.job.BsxImportJob;
import com.vastbricks.job.CatalogSynchronizationJob;
import com.vastbricks.job.PartOutValueJob;
import com.vastbricks.job.RebrickableSyncJob;
import com.vastbricks.job.WebStoreScraperJob;
import com.vastbricks.jpa.repository.MaterializedViewRefresh;
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
    private RebrickableSyncJob rebrickableSyncJob;
    private BsxImportJob bsxImportJob;
    private MaterializedViewRefresh materializedViewRefresh;

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
    public String triggerPartOutValueJob(@RequestParam(value = "sets", required = false) List<String> sets) {
        if (sets == null || sets.isEmpty()) {
            partOutValueJob.runJobAsync();
        } else {
            partOutValueJob.runJobAsync(sets);
        }
        return "ok";
    }

    @GetMapping("trigger-rebrickable-sync-job")
    public String triggerRebrickableSyncJob() {
        rebrickableSyncJob.runJobAsync();
        return "ok";
    }

    @GetMapping("trigger-bsx-import-job")
    public String triggerBsxImportJob() {
        bsxImportJob.runJobAsync();
        return "ok";
    }

    @GetMapping("refresh-materialized-view")
    public String refreshMaterializedView() {
        materializedViewRefresh.refreshCheapestOfferView();
        return "ok";
    }
}
