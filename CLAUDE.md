# Vast Bricks project guidelines

This file is living project documentation covering repository structure,
migration and coding rules, and development workflow. Feel free to update it
when architectural decisions or development workflows change. Feature
requirement specs (reconciliation, bank statement, Stripe, PayPal, invoice,
etc.) live in [`vast-docs/`](vast-docs/) instead.

## Repository direction

`vb-portal-api` is the legacy backend. It grew together with the original
requirements and must remain operational while the backend is rewritten in
small, independently deliverable steps.

The rewritten backend has two distinct modules:

- `vast-api` is only the independently launchable Spring Boot host. It contains
  runtime composition but no controllers or business features.
- `vast-services` contains all rewritten controllers and business logic. It is
  a conventional reusable Java library and must not contain a Spring Boot
  application launcher.

Both launchers depend on `vast-services`: `vast-api` for standalone local use
and `vb-portal-api` so one legacy application launch can serve old and new
functionality without introducing another production deployment unit.

`vast-services` is a temporary migration bridge, not the target architecture.
It exists only so rewritten features can run under both launchers while the
legacy backend remains in service. After all legacy functionality has moved and
`vb-portal-api` is retired, move the controllers and business logic from
`vast-services` into `vast-api`, then remove the `vast-services` module.

The names describe architectural roles, not migration status. Do not use
temporary names such as `next`, `new`, or `rewrite` for the new modules.

Any newly introduced project, module, package, or top-level tool that belongs
to the rewrite must use the `vast-*` prefix. Treat `vast-*` as the durable
rewrite namespace and do not introduce unprefixed project names for new rewrite
work.

`vast-portal` is already part of the rewrite. The current rewrite effort applies
to Java backend code only; do not create another frontend application.

## Migration principles

- Work incrementally. Do not attempt to migrate all legacy functionality in a
  single change.
- Build all rewritten controllers and business logic in `vast-services`; do
  not add rewritten implementations to either launcher.
- Place rewritten code under the durable `com.vastbricks.api` package root so
  packages remain unchanged when `vast-services` is folded into `vast-api`.
  Do not encode the temporary module name in Java packages.
- Preserve existing behavior in `vb-portal-api` unless a task explicitly
  authorizes changing or removing it.
- Do not move legacy code merely to make the new module look complete. Migrate
  one explicit vertical feature at a time in later tasks.
- The first iteration is scaffolding only. It establishes module boundaries,
  application composition, configuration, and basic runtime verification. It
  does not migrate a business feature.
- Requirements generation will be the first business area implemented after
  scaffolding. Authentication and other capabilities will move later as
  separate features.
- While both launchers coexist, keep `vast-services` independently composable.
  Its features must work under both `vast-api` and `vb-portal-api`.
- Avoid dependencies from new code to legacy Java classes, legacy entities, or
  legacy repositories. If a reusable contract is genuinely needed, create an
  explicit new boundary rather than coupling new code to an arbitrary legacy
  implementation.
- New HTTP endpoints should use a coherent, explicitly owned API namespace and
  must not shadow legacy mappings accidentally.
- Rewritten endpoints that must be private before authentication moves into the
  rewrite must use the legacy private API path prefix `/api/private/**` so they
  are protected by `vb-portal-api` when embedded in the legacy production
  application.
- Rewritten API controllers must explicitly declare JSON response production,
  preferably on their class-level `@RequestMapping` with
  `produces = MediaType.APPLICATION_JSON_VALUE`. Do not rely on default content
  negotiation: `vb-portal-api` also has an XML converter, so browser requests
  can otherwise receive XML while the same endpoint returns JSON through
  `vast-api`.
- Do not disable or override XML content negotiation globally because legacy
  endpoints still legitimately produce XML.

## Rewrite coding guidelines

- Less code is always better than more. Before writing a helper, use what is
  already there: Lombok, Spring, Jackson, and Apache Commons Lang
  (`StringUtils` and friends) are on the classpath, and pulling in a mature
  library beats hand-rolling its equivalent. The same applies to the frontend:
  prefer an existing MUI component or a maintained package over a bespoke one.
- Structure rewritten backend code by vertical feature packages, not by broad
  technical layers. Prefer packages such as `requirements`, `inventory`, or
  `pricing` that contain that feature's controllers, services, models,
  repositories, and configuration together.
- Do not create shared top-level layer packages such as `controller`, `service`,
  `repository`, `dto`, or `model` for rewrite code. Use technical subpackages
  only inside a feature package when the feature is large enough to need them.
- Cross-feature sharing is allowed when the shared capability is intentional and
  stable. For example, a Tor HTTP client can be implemented once as an explicit
  feature or infrastructure boundary and reused by other features. Do not share
  by reaching into another feature's internal implementation details.
- Shared feature boundaries must expose a small, intentional public API. For
  the Tor feature, other features request configured Spring `RestClient`
  instances from the public factory/options API and then use them as normal
  clients. Circuit switching, control-port handling, and IP polling services
  are internal implementation details and must not be exposed to other
  features.
- Do not use Java records in rewrite code. Prefer regular classes.
- Use Lombok in rewrite Java code for repetitive boilerplate such as getters,
  setters, constructors, builders, `equals`, and `hashCode` when it keeps the
  code clearer.
- For Spring controllers, services, repositories, and configuration classes,
  prefer final dependencies with Lombok `@RequiredArgsConstructor` over
  handwritten dependency-injection constructors. Write an explicit constructor
  only when it contains real custom initialization logic.
- Prefer environment-variable based configuration with explicit default values
  over Spring properties classes for rewrite settings. In Spring-managed code,
  group related values in a small feature settings class and inject values with
  field-level `@Value("${ENV_VAR:default}")`, similar to `TorSettings` and
  `FlywaySettings`; do not read environment variables with `System.getenv()`
  unless Spring injection is not available.

## Spring Boot composition

- `vast-api` defines only the new Spring Boot launcher.
- `vast-services` owns controllers, services, and shared feature configuration.
- `vast-api` and `vb-portal-api` must each depend on and explicitly import
  `vast-services`.
- `vast-services` must remain a conventional dependency JAR. Do not rely on
  executable Spring Boot JAR internals as a Maven dependency.
- The root Maven POM is an aggregator, not a parent for the application
  modules. Keep module POMs self-contained, as `vb-portal-api` is.
- Keep host-specific configuration out of domain and application logic.
- The standalone service and embedded legacy host must expose the same behavior
  for rewritten endpoints.
- Use separate ports for local standalone and legacy launches. Do not require
  both applications to run for normal development of new features.
- `vast-acceptance-tests` is a third launchable module used only for testing. It
  depends on `vast-api`, adds no launcher class, no `application.yml`, and no
  Spring configuration of its own, and inherits the whole runtime composition
  from `vast-api`. Its Maven POM declares
  `mainClass` `com.vastbricks.api.VastApiApplication` and nothing else runnable.
  Do not add runtime configuration to it; configuration belongs in `vast-api`.
- Because another module depends on `vast-api`, its executable JAR carries the
  `exec` classifier. `vast-api-1.0.jar` is a plain library JAR;
  `vast-api-1.0-exec.jar` is the one to launch.
- `vb-portal-api` must never depend on `vast-acceptance-tests`, and
  `vast-acceptance-tests` must never be deployed.

## Multitenancy

A tenant is a store the portal reconciles for. Vast holds almost no domain data
of its own — reconciliation is sourced live and stored nowhere — so what a
tenant owns is not rows so much as **which external accounts a request reaches**:
its marketplace, gateway and accounting credentials. Tenancy is therefore first
a scoping rule for settings, and only incidentally one for tables.

### How isolation is enforced

- Isolation is Hibernate's, not the database's. A tenant-owned entity carries a
  `@TenantId` field and nothing else: Hibernate stamps the serving tenant on
  insert and appends it to the SQL of every query it generates for that entity.
  No repository method names the tenant, so none can forget to.
- `VastTenantIdentifierResolver` is what Hibernate asks, and it answers from
  `TenantContext` — a thread-local bound for the length of one request.
- This is deliberately not PostgreSQL row-level security. RLS protects access
  paths the ORM does not generate, and Vast has none: feature code uses Spring
  Data JPA only, with Flyway the stated exception, and there is not one `@Query`
  or native query in `vast-services`. Both mechanisms read the same `tenant_id`
  column, so adding RLS later is a migration plus the database-role work and
  touches no Java. Do not add RLS as a side errand; it needs a runtime role that
  is not the table owner, which is an infrastructure change of its own.
- A thread with no tenant resolves to `TenantContext.NO_TENANT`, which matches
  no row. Work that never said who it was for reads nothing rather than
  everything.
- `ParallelTasks` carries the tenant across the reconciliation fan-out beside
  the debug user. A provider call on a thread that lost the tenant would reach
  no credentials at all, which fails loudly rather than reaching another store.

### What is tenant-owned and what is not

- `settings_override` is tenant-owned and is the first such table. Its rows are
  one tenant's provider credentials and setting values.
- `tenants` and `user_tenants` are identity, not tenant-owned, and carry no
  `@TenantId`. They are read to decide which tenant a request serves, which is
  necessarily before a tenant is known; filtering them by the tenant would need
  the answer they exist to give. Scope a query over them by joining the
  membership explicitly.
- `users` is likewise global. A login may serve several tenants, so a user is
  not owned by one, and the email lookup at login runs before any tenant exists.
- `debug_http_exchanges` stays scoped to the user who armed recording rather
  than to a tenant. Recording is a per-user act, and the rows are already
  invisible to anyone else.
- When a feature adds a table whose rows belong to one store: give it a
  `@TenantId` field, a `tenant_id` foreign key to `tenants (id) ON DELETE
  CASCADE`, and unique constraints that include `tenant_id`. The annotation is
  the whole of making it tenant-aware; the cascade is what keeps teardown one
  delete however many such tables exist; and the unique constraint is the one
  failure `@TenantId` does not catch for you, since two tenants writing the same
  business key would otherwise collide.

### Who a request is, and which tenant it serves

- `AuthenticationInterceptor` resolves and binds; it does not reject.
  `PrivateApiInterceptor` rejects an unresolved request on `/api/private/**`.
  They are separate because a request can be legitimately anonymous and still
  need a tenant: the test endpoints send a token without being private, and the
  legacy launcher sends none at all.
- The token carries the selected tenant as its `tid` claim, but membership is
  checked against `user_tenants` on every request rather than trusted from the
  token, so a membership taken away stops working at once instead of when the
  token expires.
- Login selects a tenant: the one named by `tenantCode`, or the caller's first.
  A login with no tenant to serve is `403`, which is a different answer from a
  wrong password and must not be reported as one.
- There is no default tenant and nothing falls back to one. A request that
  cannot say which tenant it is for gets none: it reads nothing and writes
  nowhere. Nothing legitimately anonymous needs one — `POST /api/account/login`
  reads only the global identity tables, and `GET /api/health` reads nothing.
- One caller knows which store it serves without a login behind it: the legacy
  BrickLink extension endpoint, which posts a session token under a shared API
  key. It names its tenant outright through `VAST_LEGACY_TENANT_CODE` and fails
  when that tenant does not exist, rather than falling back to one. It is the
  only such caller and it goes when `vb-portal-api` does.
- The `vastbricks` and `personal` tenants are seeded in
  `db/vast/migration/data`, which is excluded from production builds, because a
  tenant is a real store: production creates the ones it actually has,
  deliberately. The seed exists so the local administrator has something to
  serve, since a login with no membership is refused.
- There is no settings-profile header. A profile named one set of provider
  credentials and was chosen by an unauthenticated request header, which is the
  tenant question answered by whoever asked; the tenant replaced it. Each
  acceptance test gets a tenant of its own, which is what now keeps parallel
  tests from reading each other's settings.

### Guarding it

- A scenario registers its own tenant and a user who may serve it through
  `POST /api/test/tenants`, which returns the tenant, the user and a token for
  the pairing. Setting one up is setup, not subject matter, so a test does not
  reach into the database to do it. Teardown deletes the tenant, and the cascade
  takes everything that tenant wrote with it.
- Never test against the seeded `vastbricks` and `personal` tenants, and never
  sign in as the local administrator to reach them. They are the developer's own
  stores: their settings overrides name real marketplace, gateway and accounting
  accounts, so a scenario that reaches one stops testing the rewrite and starts
  calling somebody's shop. This covers manual probing with `curl` as much as it
  covers a committed test — a tenant of one's own costs a single request. The
  seeded `wiremock` tenant is not the exception either: it exists so a browser
  can be pointed at `vast-portal-test`, and a scenario that borrows it is a
  scenario sharing settings with every other one that does.
- The tenant is what isolates a scenario, so tests run in parallel without
  coordinating: each sees only its own rows, including counts.
- The isolation guardrails are acceptance tests, not Java ones. They cover
  reading and updating another tenant's row **by primary key**, not only derived
  queries — that is where the older Hibernate `@Filter` mechanism leaks, and it
  is the common path for a writable table. They also assert that a write is
  stamped with the writing tenant without being told.
- A new tenant-owned table should arrive with a scenario of the same shape.
  Assume nothing about `@TenantId` that a test has not shown.

## Database boundary

- New backend code uses a new PostgreSQL schema with a new database design.
- Use Spring Data JPA for Vast feature persistence. Do not introduce direct
  JDBC repositories in rewritten feature code; Flyway migration/bootstrap
  infrastructure is the exception.
- New code may access only tables owned by the new schema.
- Do not map, query, update, or add foreign-key dependencies to legacy tables
  from new code.
- If legacy data is required, migrate or copy it deliberately into the new
  schema as part of the relevant future feature. Do not create a permanent
  runtime dependency on the legacy data model.
- New migrations must have clear ownership and must not be mixed into the
  legacy migration history accidentally.
- Vast migration scripts must be self-contained: they may create and evolve
  only Vast-owned objects and must never query, copy from, or otherwise depend
  on legacy or other existing schemas.
- Migration execution must be safe in both runtime modes: standalone through
  `vast-api` and embedded through `vb-portal-api`.
- Database credentials and connection settings may point both runtimes at the
  same PostgreSQL server/database, but new objects remain isolated in the new
  schema.
- Local development data lives in `db/vast/migration/data`, which is excluded
  from production builds. It reaches the environment through Flyway
  placeholders that the scripts themselves declare: `VastDatabaseMigration`
  scans them for `${NAME}`, answers each from the environment, and answers
  `${NAME_ENCRYPTED}` with the same value as ciphertext under the runtime's key,
  since a secret is stored encrypted and SQL cannot encrypt. A seed that starts
  using another credential therefore changes no Java. A name the environment
  does not answer resolves to an empty string rather than failing the migration,
  so a seed skips what it cannot configure instead of writing a blank credential.
- Keep the seed in SQL rather than a Flyway Java migration. What keeps it out of
  production is the resource exclusion on that directory, and a compiled
  migration class would ride into the deployable JAR and seed a real deployment
  from its own environment.
- A repeatable `R__` migration is the place for that even though its values come
  from outside the script: Flyway checksums a repeatable migration after
  replacing its placeholders, so a rotated credential re-runs it instead of
  being ignored until the file itself is edited. Seed by inserting what is
  missing and rewriting nothing — a secret re-encrypted under a fresh nonce each
  start means the seed runs most starts, and a row the portal owns once it
  exists has to survive them. Do not rename a seed script once it has run:
  Flyway knows a repeatable migration by its description, and a renamed one
  reads as a deleted one, which fails validation until someone repairs it.

## Real data

Real provider data is how a requirement gets stated: a BrickLink export, a
Stripe balance transaction, a camt statement, a PayPal search response pasted
into the conversation is the clearest possible account of what a field actually
looks like. Read it, and never commit it.

- Real data posted in a conversation is a specification, not a fixture. Nothing
  taken from it reaches a test, a fixture, a code comment, this file, or any
  other committed file in the shape it arrived in.
- Obfuscate every value that names a person, an account, or a real transaction
  before writing it anywhere: buyer names and usernames, payer and recipient
  names, emails, addresses, phone numbers, IBANs, bank entry references,
  tracking numbers, marketplace order IDs, invoice numbers, provider
  transaction and charge IDs, and any credential or token.
- Obfuscation preserves the shape and keeps the fact under test. An IBAN stays
  an IBAN, a BrickLink order ID stays eight digits, a camt reference keeps its
  bank's own format. What changes is that the value names nobody: fictional
  names, and identifiers plainly outside a real range.
- Amounts, dates, currencies, country and tax fields carry the behavior a rule
  is about and may be kept as posted, so long as nothing beside them identifies
  whose order it was. Change an amount only when the scenario does not turn on
  it.
- Keep obfuscated names recognisably fictional and reuse the same cast across
  scenarios rather than inventing a plausible new person each time. A test
  buyer that reads like a real one invites the next reader to paste a real one
  beside it.
- This applies to code comments and to these requirements as much as to tests.
  A comment quoting a provider's wording quotes it with an obfuscated value.
- If a posted example is worth keeping for its format, keep one obfuscated
  example of it, not the dump it came from.

## Testing strategy

- When code changes affect behavior covered by acceptance tests, verification
  must rebuild the affected runtime and run the Playwright API acceptance tests.
  Use the repository CLI for this workflow, normally `./vast test --build` or
  `./vast t -b`, unless the task explicitly narrows verification or the
  acceptance-test infrastructure is unavailable.
- Do not add new Java tests to either the legacy or rewritten applications.
- Do not delete or weaken existing legacy Java tests unless a task explicitly
  requests it.
- New behavior will be verified with black-box Playwright API acceptance tests
  against a running application. Browser UI acceptance tests are out of scope.
- Acceptance tests must exercise public HTTP behavior rather than call Java
  implementation classes.
- Acceptance tests are organized into three types, each its own Playwright
  project and directory under `vast-acceptance-tests/tests`:
  - **feature tests** (`tests/features`) cover one feature's own public
    surface: its CRUD and the assertions that say the feature does its job.
    They are the answer to "does this feature work at all", and they stay
    proportionate — most features need only a handful, and a small feature
    needs very few.
  - **tech tests** (`tests/tech`) cover the technical machinery underneath
    rather than any one feature's business surface: authentication and
    login/logout, Tor, transport concerns such as status codes, error
    responses, and content negotiation.
  - **logic tests** (`tests/logic`) go into the corner cases in depth,
    addressing one component through the test-only `/api/test/**` endpoints
    and asserting its business behavior in isolation.
  Shared fixtures stay in `tests/support` and serve all three types.
- Put a scenario in the type that matches what it is asking about: the
  feature's surface, the machinery under it, or one component's corner cases.
  A feature normally has tests of more than one type, and the feature tests are
  the ones written first.
- Tests written before this split are not all sorted into it yet. Put new
  scenarios in the right type; do not rearrange the existing ones as a side
  errand.
- Components that no public endpoint exposes are tested through minimal
  test-only controllers in `vast-acceptance-tests`, mapped under `/api/test/**`.
  A test controller lives in the same package as the code it exercises so that
  code can stay package-private, and must be named so it cannot collide with a
  `vast-services` class in that package. Give it a distinct name such as
  `VastOrderFinancialsTestController`; duplicate fully qualified names across
  the two JARs are silently shadowed rather than reported.
- A test-only controller is a thin adapter: it accepts input, calls the
  component, and returns its result. Do not put business logic in it.
- `/api/test/**` is anonymous, outside the `/api/private/**` authentication
  interceptor, so scenarios need no login for it.
- Do not write acceptance tests for the transport behavior of `/api/test/**`
  endpoints: no status-code, error-message, or content-negotiation scenarios.
  Assert business behavior only. Introducing a test endpoint does not replace
  the normal fixtures; logic tests still drive providers through WireMock and
  use the existing database and settings-profile support where the component
  needs them.
- Never add `spring-boot-devtools` to `vast-acceptance-tests`. Its restart
  classloader splits the runtime package and breaks the package-private access
  the test controllers depend on.
- Tests must be deterministic, independently runnable, safe to run in parallel,
  and must not depend on state created by another test.
- Prefer API-based test setup. Add direct database setup only where the public
  API cannot reasonably establish required state.
- The same acceptance scenario should be capable of running against the
  standalone rewritten service and, where useful, the legacy host containing
  the rewritten module.
- The acceptance-test project and full service orchestration will be introduced
  in a later, explicit iteration. Initial scaffolding needs only proportionate
  runtime verification.

## Developer CLI

- The repository-level developer command is `./vast`.
- Developers who want to call it from any working directory should add a shell
  alias using the absolute repository path, matching the `./saku` setup style:
  `alias vast="/Users/mplots/git/vast-bricks/vast"`. Also source completions
  with `source <(vast completion)`. Put both lines in the active shell config,
  such as `~/.zshrc`, then restart the shell or source the updated config.
- Follow the general model of Insaku's `./saku`: provide one stable interface
  for agents and developers to build, start, stop, restart, inspect, and test
  managed local services.
- Once implemented, use `./vast` instead of ad hoc application start commands
  or direct Playwright invocations for managed acceptance workflows.
- Use `./vast test` or the shortcut `./vast t` to run Playwright API
  acceptance tests from `vast-acceptance-tests`. Both test types run by
  default; pass `--tech` or `--logic` to run only one. Pass `-b` or `--build`
  when the managed `vast-api-test` should be rebuilt and restarted before
  running tests. Pass `-cb` or `--clean-build` to rebuild it and run the tests
  with the Vast database schema cleaned and migrated from scratch.
- The CLI should eventually manage PostgreSQL readiness, migrations, service
  readiness, focused Playwright API runs, restarts after code changes, logs, and
  cleanup.
- Add CLI capabilities incrementally with the workflow that needs them; do not
  build the entire final CLI during module scaffolding.
- The managed service named `vast-api-test` builds and runs the
  `vast-acceptance-tests` JAR on port 6362, so the test-only endpoints are
  available locally. Acceptance tests always run against it.
- The managed service named `vast-api` builds and runs the `vb-portal-api`
  JAR on port 6363, so one launch serves the legacy and rewritten halves of the
  backend exactly as the deployed artifact does. `./vast` sets `SERVER_PORT`
  because the legacy application fixes port 6161 for IntelliJ launches.
- `vast-api` reads its configuration from an external environment file of
  `KEY=value` lines, legacy settings and rewrite settings alike, by default `~/.vast/vast-api.env` and otherwise the path
  `VAST_API_ENV_FILE` names. The file holds production credentials, so it lives
  outside the repository, `./vast` refuses a path inside the working tree or a
  file readable beyond its owner, and its values are passed only to the
  `vast-api` process.
- No other managed service may ever read that file. `vast-api-test` runs
  acceptance tests against mocked providers and must never be given production
  credentials, by an environment file, a shell that sourced one, or any other
  route. Only `./vast`'s own settings for the managed port win over the file.
- Every command that takes service names covers every service when given none:
  `./vast services start` starts them all, `restart` restarts them all, and
  listing and stopping have always done so. A developer starting their
  environment wants the environment, not most of it, and a service left out of
  "all" is one that is silently missing exactly when something does not work.
- `./vast services` (alias `./vast svc`) manages `postgres`, `tor-proxy`,
  `vast-api-test`, `vast-api`, `wiremock`, `vast-portal`, and
  `vast-portal-test`. Managed application instances use ports 6362, 6363, 9011,
  3100, and 3101 respectively, leaving the normal IntelliJ ports 6161, 6262,
  and 3200 available for independently launched instances.
- There are two managed portals because there are two backends, and which
  backend a portal proxies `/api/**` to is the whole difference between them.
  `vast-portal` on 3100 proxies to `vast-api` on 6363, so it runs against the
  same backend a deployment serves. `vast-portal-test` on 3101 proxies to
  `vast-api-test` on 6362, whose providers are the managed WireMock.
- The managed `vast-portal` therefore sits in front of production data. Never
  sign in to it, drive it with browser automation, or click anything in it: its
  screens act on real marketplace orders and can generate real invoices, and its
  credentials are the deployment's own. Agents must not enter credentials there
  under any circumstances, and a running portal on 3100 is not a place to verify
  a change.
- `vast-portal-test` is that place instead. It is the one portal a change may be
  driven in a browser to check, because everything its screens read and
  everything they do stops at WireMock: a scenario is stubbed there, the screen
  is opened at 3101, and no real account is reachable from it at all. A
  developer's own screenshot and a throwaway page under the scratchpad remain
  the other two routes, and none of the three touches production.
- What a browser signs in as there is a tenant of its own, seeded by `./vast`
  when `vast-api-test` starts: `wiremock@vastbricks.test` / `wiremock`, whose
  every provider is the managed WireMock under credentials that are plainly
  nobody's. The credentials are there because a client refuses to call a
  provider it holds no credential for, so a base URL alone would leave the
  screens unable to read a stub at all.
- It has to be a tenant and not the runtime's own environment. An environment
  value wins over a database override by design, so a provider set in the
  environment would take that setting away from every scenario that overrides
  it — the acceptance suite sets exactly these keys, per tenant, on its own
  WireMock host. The seed is therefore rows like a scenario's own, and one more
  tenant is invisible to the scenarios beside it.
- It is seeded by the CLI rather than by the local Flyway data because a secret
  override is encrypted with the runtime's own key, which SQL cannot do, and
  because the deployable runtime applies that same data to the same database.
- `./vast ps` is the shortcut for `./vast services list`.
- `./vast prod` reaches the production host. `./vast prod async` replaces the
  local copies of production's order data, each by emptying its directory and
  copying production's into it with `scp -r`. It copies two things: the store's
  order archive, which empties `VAST_ORDER_ARCHIVE_DIR` (default
  `/tmp/vast-bricks/order-archive`) and lands under the tenant directory it is
  copied as, and BrickSync's own record of the orders it synchronized, which
  replaces `VAST_BRICKSYNC_ORDERS_DIR` (default
  `/tmp/vast-bricks/bricksync-orders`) with that directory itself. The two sit
  beside each other rather than one inside the other: the archive is a
  directory per tenant and BrickSync's orders are one directory for every store
  it syncs, so a copy of the second under the first would read as a tenant
  named after a program. Both halves are attempted whatever the other did, so
  a host that would not serve one does not leave the other quietly uncopied.
  The copied files are a real store's own record of who bought what, so they
  stay in `/tmp` and are never committed or pasted anywhere.
- An agent must never run a `./vast prod` subcommand without asking first, and
  asking once does not carry to the next time. These commands touch the
  deployment, and what they bring back is real customer data.
- Runtime process state and logs belong under the ignored `.vast` directory.
  Service stop operations must affect only processes recorded and verified as
  owned by `./vast`; never terminate an arbitrary process solely because it
  occupies a configured port.

## Planned delivery phases

1. **Scaffold modules**
   - Add `vast-api` and `vast-services` to the Maven reactor.
   - Create the standalone `vast-api` Spring Boot launcher and minimal
     configuration.
   - Establish `vast-services` as the reusable controllers-and-business-logic
     dependency.
   - Include `vast-services` in `vb-portal-api` without migrating business
     behavior.
   - Prove that the standalone host and legacy host can both start with the new
     module composition.
2. **Establish database ownership**
   - Create the new schema and its independently owned migration configuration.
   - Verify migration behavior in standalone and embedded runtime modes.
3. **Establish acceptance infrastructure**
   - Add the `./vast` workflows needed to manage dependencies and services.
   - Add Playwright API acceptance-test structure and a minimal health scenario.
4. **Implement requirements generation**
   - Design the new requirements data model and API without reusing legacy
     persistence code.
   - Migrate required legacy data explicitly where necessary.
   - Deliver behavior in small vertical slices covered by API acceptance tests.
5. **Migrate later features**
   - Move authentication and other legacy capabilities one feature at a time.
   - Retire legacy behavior only after its replacement is complete and verified.
6. **Complete the rewrite**
   - Retire `vb-portal-api` after all required functionality has moved.
   - Move all code from `vast-services` into `vast-api`.
   - Remove `vast-services`, leaving `vast-api` as the complete backend
     application.

Do not silently pull work from a later phase into the current phase. If a task
requires crossing a phase boundary, state why before expanding the change.

## Scope and deployment

- Backend deployment procedures are owned separately and are not part of this
  rewrite unless a task explicitly includes them.
- Maintain the ability to deploy one legacy application artifact containing old
  and rewritten functionality.
- Local development should normally require only PostgreSQL and `vast-api` for
  work on rewritten features.

## Version control workflow

- Do not create a branch for new feature work. Work on the currently checked-out
  branch unless the user explicitly asks for a branch.
- Do not switch branches, and do not commit or push unless the user asks.

## Existing module conventions

- More specific `AGENTS.md` files override these repository-wide guidelines for
  files in their directory tree.
- Preserve the conventions in `vb-portal-api/AGENTS.md` when modifying that
  module.
- Do not edit generated files or files under build output and dependency
  directories such as `target`, `dist`, or `node_modules`.
- Always respect user changes in the worktree. Do not revert, restore,
  normalize, or "fix" existing user edits unless the user explicitly asks for
  that exact change. If a user edit appears to break verification or conflicts
  with the requested task, stop and explain the conflict instead of changing it
  silently.
- Never overwrite unrelated work in a dirty worktree.
