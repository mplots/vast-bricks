package com.vastbricks.api.job;

import com.vastbricks.api.tenancy.TenantContext;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

/**
 * A job that follows {@link VastTestJob}, so a scenario can drive the chaining without a provider.
 *
 * <p>It counts its runs per tenant, as the job it follows does: acceptance scenarios run in parallel with a tenant
 * each, and one scenario's chain must neither see nor block another's.
 */
@Component
class VastTestFollowerJob implements Job {

    static final String CODE = "test-follower-job";

    private final Map<Long, AtomicLong> ran = new ConcurrentHashMap<>();

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public Optional<String> after() {
        return Optional.of(VastTestJob.CODE);
    }

    @Override
    public JobTally run() {
        return JobTally.empty().count("ran", counter().incrementAndGet());
    }

    private AtomicLong counter() {
        return ran.computeIfAbsent(TenantContext.currentTenantIdOrNone(), tenant -> new AtomicLong());
    }
}
