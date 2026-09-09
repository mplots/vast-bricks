package com.vastbricks.api.job;

import com.vastbricks.api.tenancy.TenantContext;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

/**
 * A job that does exactly what a scenario tells it to, so the jobs framework can be tested without a provider.
 *
 * <p>Everything it holds is keyed by tenant: acceptance scenarios run in parallel, each with a tenant of its own, and
 * one scenario's job must neither see nor block another's. It declares no cron — a scheduled job in the acceptance
 * runtime would fire on its own while a scenario was watching.
 */
@Component
class VastTestJob implements Job {

    static final String CODE = "test-job";

    private final Map<Long, Behaviour> behaviours = new ConcurrentHashMap<>();

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public Optional<String> cron() {
        return Optional.empty();
    }

    @Override
    public JobTally run() {
        Behaviour behaviour = behaviourOf(TenantContext.currentTenantIdOrNone());
        long ran = behaviour.ran.incrementAndGet();
        behaviour.await();
        if (behaviour.failing) {
            throw new IllegalStateException("The test job was asked to fail");
        }
        return JobTally.empty().count("ran", ran);
    }

    /** Makes the next run succeed, fail, or wait until the scenario releases it. */
    void behave(Long tenantId, String outcome) {
        Behaviour behaviour = behaviourOf(tenantId);
        behaviour.failing = "fail".equals(outcome);
        behaviour.gate = "block".equals(outcome) ? new CountDownLatch(1) : null;
    }

    /** Lets a blocked run finish. */
    void release(Long tenantId) {
        CountDownLatch gate = behaviourOf(tenantId).gate;
        if (gate != null) {
            gate.countDown();
        }
    }

    private Behaviour behaviourOf(Long tenantId) {
        return behaviours.computeIfAbsent(tenantId, tenant -> new Behaviour());
    }

    private static final class Behaviour {

        private final AtomicLong ran = new AtomicLong();

        private volatile boolean failing;

        private volatile CountDownLatch gate;

        private void await() {
            CountDownLatch waiting = gate;
            if (waiting == null) {
                return;
            }
            try {
                // Bounded, so a scenario that forgets to release cannot leave a thread waiting for the whole run.
                waiting.await(30, TimeUnit.SECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
