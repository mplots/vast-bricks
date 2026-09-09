package com.vastbricks.api.job;

import com.vastbricks.api.tenancy.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tells {@link VastTestJob} how to behave, so a scenario can drive the jobs framework through its real endpoints.
 */
@RestController
@RequestMapping(path = "/api/test/jobs", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastJobTestController {

    private final VastTestJob testJob;

    @PutMapping("/behaviour")
    void behave(@RequestParam("outcome") String outcome) {
        testJob.behave(TenantContext.currentTenantIdOrNone(), outcome);
    }

    @PostMapping("/release")
    void release() {
        testJob.release(TenantContext.currentTenantIdOrNone());
    }
}
