import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';

/**
 * The jobs framework, driven through its own endpoints with a job that does what the scenario tells it to.
 *
 * <p>What these are about is the account a job keeps of itself: that a run is written down as it starts, that its
 * outcome and what it came to are still there afterwards, and that one job runs once at a time for one tenant.
 */

const testJob = 'test-job';

type Run = {
  id: number;
  jobCode: string;
  triggeredBy: string;
  outcome: string;
  startedAt: string;
  finishedAt: string | null;
  tally: Record<string, number>;
  failure: string | null;
};

type JobStatus = { code: string; cron: string | null; running: boolean; lastRun: Run | null };

async function jobs(request: APIRequestContext): Promise<JobStatus[]> {
  const response = await request.get('/api/private/jobs');
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as { jobs: JobStatus[] }).jobs;
}

async function statusOf(request: APIRequestContext, code = testJob): Promise<JobStatus> {
  const response = await request.get(`/api/private/jobs/${code}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as JobStatus;
}

async function behave(request: APIRequestContext, outcome: 'succeed' | 'fail' | 'block' | 'block,fail') {
  const response = await request.put(`/api/test/jobs/behaviour?outcome=${outcome}`);
  expect(response.status(), await response.text()).toBeLessThan(300);
}

async function trigger(request: APIRequestContext, code = testJob) {
  return request.post(`/api/private/jobs/${code}/run`);
}

async function cancel(request: APIRequestContext, code = testJob) {
  return request.post(`/api/private/jobs/${code}/cancel`);
}

/** Starts a run that waits, and answers once the job is actually working. */
async function started(request: APIRequestContext, outcome: 'block' | 'block,fail' = 'block') {
  await behave(request, outcome);
  expect((await trigger(request)).status()).toBe(202);
  await expect.poll(async () => (await statusOf(request)).running, { timeout: 15_000 }).toBe(true);
}

async function settled(request: APIRequestContext, code = testJob): Promise<Run> {
  await expect
    .poll(async () => (await statusOf(request, code)).lastRun?.outcome, { timeout: 15_000 })
    .not.toBe('running');
  return (await statusOf(request, code)).lastRun as Run;
}

test('every registered job is listed with the schedule it declares', async ({ request }) => {
  const listed = await jobs(request);

  expect(listed.map((job) => job.code)).toContain(testJob);
  // A job that declares no cron only ever runs when someone asks for it, and says so by having none.
  expect(listed.find((job) => job.code === testJob)?.cron).toBeNull();
});

test('a job that has never run for this tenant reports no last run', async ({ request }) => {
  expect((await statusOf(request)).lastRun).toBeNull();
  expect((await statusOf(request)).running).toBe(false);
});

test('a run started by hand is recorded with what it came to', async ({ request }) => {
  await behave(request, 'succeed');

  const response = await trigger(request);
  expect(response.status(), await response.text()).toBe(202);
  // Answered with the run it opened, so a screen has something to watch while the job works.
  await expect(response.json()).resolves.toMatchObject({ jobCode: testJob, triggeredBy: 'manual', outcome: 'running' });

  const run = await settled(request);
  expect(run.outcome).toBe('succeeded');
  expect(run.tally).toEqual({ ran: 1 });
  expect(run.failure).toBeNull();
  expect(run.finishedAt).not.toBeNull();
});

test('a job that throws is recorded as failed, with what it threw', async ({ request }) => {
  await behave(request, 'fail');
  expect((await trigger(request)).status()).toBe(202);

  const run = await settled(request);
  expect(run.outcome).toBe('failed');
  expect(run.failure).toContain('The test job was asked to fail');
  // A failed run states no tally: the job never got as far as saying what it came to.
  expect(run.tally).toEqual({});
});

test('a job already running for this tenant is refused rather than started twice', async ({ request }) => {
  await behave(request, 'block');
  expect((await trigger(request)).status()).toBe(202);

  await expect.poll(async () => (await statusOf(request)).running, { timeout: 15_000 }).toBe(true);

  const second = await trigger(request);
  expect(second.status()).toBe(409);

  const release = await request.post('/api/test/jobs/release');
  expect(release.status(), await release.text()).toBeLessThan(300);

  expect((await settled(request)).outcome).toBe('succeeded');
  expect((await statusOf(request)).running).toBe(false);
});

test('the runs of a job are kept, newest first', async ({ request }) => {
  await behave(request, 'succeed');
  expect((await trigger(request)).status()).toBe(202);
  await settled(request);
  expect((await trigger(request)).status()).toBe(202);
  await settled(request);

  const response = await request.get(`/api/private/jobs/${testJob}/runs`);
  expect(response.status(), await response.text()).toBe(200);
  const runs = ((await response.json()) as { runs: Run[] }).runs;

  expect(runs).toHaveLength(2);
  expect(runs.map((run) => run.tally.ran)).toEqual([2, 1]);
});

test('a job no one registered is not found', async ({ request }) => {
  expect((await request.get('/api/private/jobs/not-a-job')).status()).toBe(404);
  expect((await trigger(request, 'not-a-job')).status()).toBe(404);
});

test("a tenant's runs are invisible to another tenant", async ({ request, otherTenant }) => {
  await behave(request, 'succeed');
  expect((await trigger(request)).status()).toBe(202);
  await settled(request);

  expect((await statusOf(otherTenant.request)).lastRun).toBeNull();
  const response = await otherTenant.request.get(`/api/private/jobs/${testJob}/runs`);
  await expect(response.json()).resolves.toMatchObject({ runs: [] });
});

test('a running job is stopped when someone asks it to', async ({ request }) => {
  await started(request);

  const response = await cancel(request);
  expect(response.status(), await response.text()).toBe(202);
  // Answered with the run it asked to stop, which is still going: stopping is asking, so the screen watches the
  // same run it was watching before.
  await expect(response.json()).resolves.toMatchObject({ jobCode: testJob, outcome: 'running' });

  const run = await settled(request);
  expect(run.outcome).toBe('cancelled');
  expect(run.finishedAt).not.toBeNull();
  // Not a failure: nothing broke, so there is no diagnostic to show for it.
  expect(run.failure).toBeNull();
  expect((await statusOf(request)).running).toBe(false);
});

test('a stopped run keeps what the job counted before it stopped', async ({ request }) => {
  await started(request);

  expect((await cancel(request)).status()).toBe(202);

  expect((await settled(request)).tally).toEqual({ ran: 1 });
});

test('a job that throws on its way out of a stopped run is still stopped rather than failed', async ({ request }) => {
  await started(request, 'block,fail');

  expect((await cancel(request)).status()).toBe(202);

  const run = await settled(request);
  expect(run.outcome).toBe('cancelled');
  expect(run.failure).toBeNull();
});

test('a job that is not running has nothing to stop', async ({ request }) => {
  expect((await cancel(request)).status()).toBe(409);

  await behave(request, 'succeed');
  expect((await trigger(request)).status()).toBe(202);
  await settled(request);

  // A run that has already ended is no more stoppable than one that never started.
  expect((await cancel(request)).status()).toBe(409);
});

test('a job no one registered cannot be stopped', async ({ request }) => {
  expect((await cancel(request, 'not-a-job')).status()).toBe(404);
});

test("one tenant cannot stop another tenant's run", async ({ request, otherTenant }) => {
  await started(request);

  // The other tenant sees no run of this job at all, so there is nothing there for them to stop.
  expect((await cancel(otherTenant.request)).status()).toBe(409);

  const release = await request.post('/api/test/jobs/release');
  expect(release.status(), await release.text()).toBeLessThan(300);
  expect((await settled(request)).outcome).toBe('succeeded');
});
