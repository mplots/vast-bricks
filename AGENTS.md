# Vast Bricks project guidelines

This file is living project documentation. Feel free to update it when project
requirements, architectural decisions, or development workflows change.

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
- Prefer direct environment-variable based configuration with explicit default
  values over Spring properties classes for rewrite settings.

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

## Database boundary

- New backend code uses a new PostgreSQL schema with a new database design.
- New code may access only tables owned by the new schema.
- Do not map, query, update, or add foreign-key dependencies to legacy tables
  from new code.
- If legacy data is required, migrate or copy it deliberately into the new
  schema as part of the relevant future feature. Do not create a permanent
  runtime dependency on the legacy data model.
- New migrations must have clear ownership and must not be mixed into the
  legacy migration history accidentally.
- Migration execution must be safe in both runtime modes: standalone through
  `vast-api` and embedded through `vb-portal-api`.
- Database credentials and connection settings may point both runtimes at the
  same PostgreSQL server/database, but new objects remain isolated in the new
  schema.

## Testing strategy

- Do not add new Java tests to either the legacy or rewritten applications.
- Do not delete or weaken existing legacy Java tests unless a task explicitly
  requests it.
- New behavior will be verified with black-box Playwright API acceptance tests
  against a running application. Browser UI acceptance tests are out of scope.
- Acceptance tests must exercise public HTTP behavior rather than call Java
  implementation classes.
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
  acceptance tests from `vast-acceptance-tests`. Pass `-b` or `--build` when
  the managed `vast-api` should be rebuilt and restarted before running tests.
- The CLI should eventually manage PostgreSQL readiness, migrations, service
  readiness, focused Playwright API runs, restarts after code changes, logs, and
  cleanup.
- Add CLI capabilities incrementally with the workflow that needs them; do not
  build the entire final CLI during module scaffolding.
- `./vast services` (alias `./vast svc`) manages `postgres`, `tor-proxy`,
  `vast-api`, `wiremock`, and `vast-portal`. Managed application instances use
  ports 6362, 9010, and 3100 respectively, leaving the normal IntelliJ ports
  6262 and 3000 available for independently launched instances.
- `./vast ps` is the shortcut for `./vast services list`.
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
