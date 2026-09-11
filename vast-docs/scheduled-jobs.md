# Scheduled jobs feature requirements

Some of the backend's work is not a request: an archive is taken nightly, a catalog is synchronised, a store is
scraped. The legacy application has seven such jobs, each with a cron and a trigger endpoint, and between runs they
say nothing — whether one is working, whether last night's failed, and what it did are readable only in the server
log. The rewrite's jobs feature is that shape with the account kept.

- A job is a class implementing `Job` in `com.vastbricks.api.job`, declared as a bean in the feature package of the
  work it does. The `job` package holds the boundary, the run store, the scheduler and the screen's endpoints, and
  never a job implementation: a job in there would make it the layer package the rewrite does not have.
- Adding a job changes nothing else. It states its code, the cron it fires on if it has one, and what its run came
  to. The scheduler, the endpoints and the screen follow.
- A job is tenant-specific, and which tenants a firing means is the difference between the two ways of firing one:
  the schedule runs it for every active tenant, and the portal runs it for the tenant the caller is serving. The
  tenant is bound to the thread before the job runs, so a job reads its store's settings and credentials without
  ever asking whose run it is.
- A scheduled firing starts each tenant's run separately, on a thread of its own. A tenant's credentials are its
  own, so two stores reach two different provider accounts and there is nothing shared between them to take turns
  over; one store being slow, or failing, therefore says nothing about when the next one runs. Each store's run is
  its own row, and a store already running that job is skipped rather than delaying anyone. The scheduler does not
  wait for them: nobody is watching when a cron fires, which is the whole reason runs are stored.
- One job runs once at a time per tenant. A second firing while one is going is refused rather than queued: it
  would reach the same providers and write the same files as the run already doing so. Another tenant's run of the
  same job is not that.
- A running job can be stopped by hand, which is asking rather than killing: the JVM offers interrupting the thread
  and nothing else, so what actually stops is a job that notices. A job that works through a list should check
  whether its thread was interrupted between items and return what it has, and one that blocks should let the
  interruption out. The archive job checks, because it archives every order under a `catch` that would otherwise
  read the interruption as one order that could not be archived and carry on through the rest.
- The run is marked stopped whether or not the job noticed, so one that runs on to its end is still recorded as
  `cancelled` rather than as having succeeded: what a reader wants to know is that someone stopped this run.
- A `cancelled` run is not a `failed` one and states no diagnostic. Nothing broke — a job was stopped — and what it
  threw on its way out is the stopping rather than a fault of its own. It keeps whatever it managed to count, since
  what a stopped run got through is exactly what a reader is left asking.
- `cancelled` is a person stopping a run and `interrupted` is a process stopping one; they are different facts and
  neither is worded as the other.
- Only the serving tenant's run is stoppable, as only their runs are readable. There is nothing to stop when the job
  is not running for that tenant, and that is refused the same way starting a second run is.
- Stopping happens through the run in progress, which is the same registry that single-flights a job per tenant.
  That registry stays the lock rather than the account: what a screen reads is still the stored run.
- The interrupt is cleared before the run is written down. Writing it is a database call, and an interrupt left
  standing on the thread would break it — leaving the run recorded by nothing at all.
- Run state is stored, in the tenant-owned `job_runs` table, rather than held in memory. A job that failed at three
  in the morning has to still say so in the morning, and how a job has been going is worth more than how it is
  going now. History is kept; a retention window is the obvious follow-up if the table grows.
- A run is written down as it starts, not when it ends, so a screen watching a job sees it working. A row left
  running by a process that stopped is closed as `interrupted` when the next one starts: nothing in progress
  survives a restart.
- A job reports codes and numbers, never sentences. What a run came to is a `JobTally` of named counts, and the
  wording of each count lives in the `vast-portal` catalogs keyed by its name, exactly as a reconciliation
  failure's wording does. A failure is the one exception and is not wording either: what the job threw is stored as
  a technical diagnostic and shown as it is, the way the debug dock shows a provider's own payload.
- The scheduler is off unless `VAST_JOBS_SCHEDULER_ENABLED` says otherwise. A cron that fires by default fires in
  every runtime `vast-services` is composed into — an acceptance run against mocked providers, and a developer's
  local launch against real credentials — so the deployment turns it on deliberately and nothing else does.
- It runs on a scheduler of its own rather than through `@EnableScheduling`, so composing `vast-services` into
  `vb-portal-api` changes nothing about how the legacy application's own scheduled work is executed.
- The screen is `/jobs`: a card per registered job rather than a row per job. The jobs are few and each has a good
  deal to say — a schedule, a state, a moment, a duration, a tally of counts — and a table of that is a grid read
  across columns nobody compares one job to another in. What a reader compares is a job against its own past.
- A card states the job, the cron it fires on or that it only runs when asked, how it last went and what that came
  to, and carries the two things a reader does to it. The state is said twice over: a chip in words, and the mark
  beside the name, which turns to a spinner while the job works — a working job is what the screen is opened to
  find, and a spinner says so without being read.
- The buttons are labelled rather than bare icons, unlike the tool buttons every reading screen carries. This is
  the one screen that does something to the backend instead of reading it, and a control that fires a nightly job
  by hand, or stops one halfway, should say which in a word. Stop stands where Run stood, because the place a run
  was started from is where a reader looks to stop it.
- Each card opens its own recent runs, which are asked for only then: how a job has been going is worth more than
  how it is going now, but it is still a second question, and a screen of jobs nobody has opened has no reason to
  ask it. They are polled while the job works, so the run being watched lands in its own history when it ends.
- The runs read as a timeline rather than a table: they are the same few facts over and over, and what is wanted is
  the shape of them down time — a run that failed among the ones that did not, a nightly job that skipped a night.
  A dot per run says which was which without a column headed for it, and never carries the outcome alone: every run
  states it in words beside the moment it started, with how long it took and whether the schedule or a person fired
  it. That last is on no other screen, and it is what tells last night's run from someone's retry of it.
- Cards of one row are of one height, but nothing inside one is stretched to fill it. A card opening its runs makes
  the row tall, and a neighbour that pushed its buttons to the bottom would strand them under an empty card.
- The screen polls only while something is running — a screen of idle jobs has nothing to ask about. Every new
  user-visible string goes into both `en.json` and `lv.json`, and a job's own name is one of them, keyed
  `job-<code>`. The wording of a tally count and of an outcome are others; a stopped run wears neither the colour of
  a success nor that of a problem.
- The endpoints are `GET /api/private/jobs`, `POST /api/private/jobs/{code}/run`, which answers `202` with the run
  it opened and `409` when one is already going, `POST /api/private/jobs/{code}/cancel`, which answers `202` with
  the run it asked to stop and `409` when there is none, and `GET /api/private/jobs/{code}/runs` for the history.
  Cancelling answers `202` and a run that is still going for the same reason starting one does: stopping is asking,
  so the screen goes on watching the same run to see it actually stop. The
  controller is `JobsController`, not `JobController`: `vb-portal-api` already has a bean of that name and the
  legacy launcher scans both.
- Acceptance tests are tech tests through those endpoints. The framework itself is driven by a test-only `Job` in
  `vast-acceptance-tests` that succeeds, fails, or blocks as a scenario tells it to, so what a run records can be
  tested without a provider. Those words are read as a set rather than as one, so a job that blocks and then throws
  states the case a stopped run must not be recorded as a failed one.

### BrickLink order archive requirements

The first job of the rewrite, and the reason the feature exists. It keeps the store's own copy of what BrickLink
held for an order, against the day BrickLink no longer holds it.

- It runs nightly at 03:00, and archives every order BrickLink lists for the store.
- Three files per order, named after the moment the order last changed — `api-<id>-<changed>.json`,
  `accounting-<id>-<changed>.xml`, `vat-invoice-<id>-<changed>.pdf` — so an order that changes again is archived
  again beside its earlier state rather than over it.
- The API file is BrickLink's own response as it sent it, not a model of it written back out: an archive that
  dropped a field the day BrickLink added it would be an archive of what the rewrite happened to parse.
- The accounting export is the one a signed-in store sees, through `BrickStoreClient`. The VAT invoice is asked for
  only where BrickLink states it collected the VAT, that being the only case in which it issued one.
- An order whose files are all there is left alone, which is what makes running this nightly cheap. What is checked
  is the file names, so an order whose state changed is not mistaken for one already archived.
- One order that cannot be archived is counted and the run goes on: a provider that would not state one order has
  not stopped the rest of the month from being archived. The tally is `archived`, `unchanged` and `failed`.
- The archive is written under `<VAST_ORDER_ARCHIVE_DIR>/<tenant-code>/`. By tenant, because what is in it is
  BrickLink's record of who bought what from that store; by code rather than by id, because a person looking in the
  directory should see which store it holds.
- `OrderArchive` is the feature's whole public API: the directory of the serving tenant, and archiving one order
  by id. `vb-portal-api`'s archives screen calls it with no shim between them, being under `/api/private/**`, which
  the rewrite's own interceptor authenticates in the legacy launcher exactly as it does in `vast-api` — so a legacy
  screen already has a tenant bound by the time it asks.
- The one caller with no tenant is the shipping label the BrickLink browser extension posts for, which comes from
  the marketplace with no login anywhere in the flow and writes the VAT invoice it carries into the same archive.
  It names its store by `VAST_LEGACY_TENANT_CODE`, as the extension's own token endpoint does, and binds it itself
  rather than through a type in the archive feature: an endpoint that cannot say who it is for is that endpoint's
  problem, and it goes when `vb-portal-api` does.
- `BRICKLINK_ORDER_ARCHIVE_DIR` is gone: `VAST_ORDER_ARCHIVE_DIR` is the single source, overridable per tenant like
  every other rewrite setting.
- BrickLink's published store API is `com.vastbricks.api.client.bricklink`, signed one-legged OAuth 1.0a in the
  `Authorization` header. The signing is written in the package rather than taken from a library: the one the
  legacy client used is built on Apache HttpClient 4, which `vast-services` does not otherwise carry.
- BrickLink answers a refused request with HTTP 200 and the refusal in the envelope's `meta`, so the status alone
  says nothing and the client reads the code there. Without that check a request signed with the wrong credentials,
  or made from an address the token is not whitelisted for, reads as a store with no orders — and an archive job
  that reports having archived nothing is indistinguishable from one that had nothing to archive. The legacy client
  did not check it either.

