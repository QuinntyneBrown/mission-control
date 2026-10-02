# Initialize and protect the administrator

## Overview

Deployment initializes the schema before the application becomes ready to serve users.

- **Bootstrap** — repeatable initialization that creates or repairs the designated administrator
- **Readiness** — ability to serve requests after schema, SQL, and required seeds succeed

The bootstrap account and City lead are independent records. Existing administrator passwords remain unchanged during initialization and recovery.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.
Exceptions: this slice has no screen of its own, initialization runs in the host without a user request, so its audit events carry no actor, and the health endpoints answer without a session.

| Part | Responsibility and architectural home |
| --- | --- |
| `DatabaseInitializer` | Infrastructure `BackgroundService` inside the `MissionControl.Api` host. Its `ExecuteAsync` runs after the host starts listening, so the health endpoints answer during the run; it checks the signing material in `JwtOptions` first, then holds the initialization lock, runs migrations, sends `EnsureRequiredSeedsCommand` with the run's correlation ID, and records the outcome. |
| `InitializationOptions` | Application options class bound from external configuration: designated email, first and last name, and the initial password used only when the account is absent. [Account management](../manage-accounts/README.md) reads its `designatedEmail` to identify the designated administrator. |
| `IInitializationLock`, `IMigrationRunner` | Application ports with SQL adapters in Infrastructure: the database-wide initialization lock and the versioned migration runner. |
| `EnsureRequiredSeedsCommand`, `EnsureRequiredSeedsCommandHandler` | Application command and handler; create or repair the designated administrator, adopt or create the City contact once, set the seed marker, and register an audit event for each change, committing all of it once through `SaveChangesAsync`. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this slice uses `LoadAccountByEmailAsync`, `LoadLeadByEmailAndCategoryAsync`, `LoadSeedMarkerAsync`, `AddAccount`, `AddLead`, `AddSeedMarker`, `AddAuditEvent`, and `SaveChangesAsync`. |
| `IPasswordHashService` | Shared Application [security port](../../README.md#data-access-and-security-ports); hashes the initial password for a new account only. |
| `UserAccount`, `LeadContact`, `SeedMarker`, `AuditEvent` | Domain entities. `SeedMarker` records a completed one-time seed by key; the City seed uses the key `CityLeadSeedCompleted`. `AuditEvent` is the shared insert-only audit record that [audit review](../review-audit-events/README.md) reads. |
| `InitializationStatus`, `InitializationState` | Application singleton and its value: the latest phase (`Initializing`, `Ready`, or `Failed`) with a correlation ID on failure. |
| `HealthController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; answers liveness directly and dispatches `GetReadinessQuery`. |
| `GetReadinessQuery`, `GetReadinessQueryHandler` | Application query and handler; combine `InitializationStatus` with a live check through `IDatabaseReadinessProbe`. |
| `IDatabaseReadinessProbe` | Application port with a SQL adapter in Infrastructure; `CheckAsync(ct)` reports SQL access and a compatible schema version without exposing connection details. |

There is no separate initialization program. `DatabaseInitializer` in Infrastructure runs inside the `MissionControl.Api` host as a `BackgroundService`.
The host starts listening first and `ExecuteAsync` runs the initialization in the background, so `GET /health/live` answers `200` and `GET /health/ready` answers `503` with `Initializing` throughout the run.
It holds readiness false until it completes, so no instance reports ready before its own initialization succeeds.
It applies versioned SQL migrations and then sends one `EnsureRequiredSeedsCommand`, handled in Application through MediatR.
That one command owns the seed transaction: its handler loads and changes the administrator, the City contact, and the seed marker on one scoped data session and commits them once through `SaveChangesAsync(ct)`.
`InitializationOptions` binds external bootstrap identity and initial password from the PRD. The designated normalized email is `quinntynebrown@gmail.com`.
The designated administrator is the account whose normalized email equals `InitializationOptions.designatedEmail`; account emails never change, so seeding and account management always identify the same account.
The exact initial password remains specified in L2-006 and the PRD; production code reads external configuration and stores only its salted hash from `IPasswordHashService`.
`IMigrationRunner`, `IInitializationLock`, and the SQL implementation provide repeatability and a database-wide initialization lock.
Each instance initializes under `IInitializationLock` (L2-007.2). A later instance waits for the lock, finds migrations applied and the account present, and reports ready.
`InitializationStatus` records the outcome as `InitializationState` for readiness checks. The selected SQL provider and migration-lock implementation are `<TO SUPPLY>` before this slice is implemented.
Every asynchronous member here, from `ExecuteAsync` and the lock and migration ports to the handlers and the readiness probe, takes a `CancellationToken`; host shutdown cancels the stopping token, so a run cancelled before commit leaves no seed change.

The handler loads the designated account with `LoadAccountByEmailAsync` inside the seed transaction.
An absent account requires valid bootstrap configuration and is added with `AddAccount`; failure rolls back seed changes and keeps readiness false.
An existing account retains ID, credential version, and password hash. Its first name, last name, active flag, and Administrator role are restored to the bootstrap values.
Application operations cannot rename the designated account, so this repair only reverses out-of-band database changes (L2-006).
The unique email index and initialization lock prevent concurrent duplicates. Initialization retries read the winning account rather than replacing it.
The City seed reads `LoadSeedMarkerAsync("CityLeadSeedCompleted")` in the same seed transaction.
Without the marker, its first successful run adopts the City contact found by `LoadLeadByEmailAndCategoryAsync`, or adds Quinntyne Brown with no phone through `AddLead`, and then adds the marker with `AddSeedMarker`.
With the marker present, later runs leave that contact untouched.
The marker prevents a subsequent email/category edit or permitted contact deletion from creating a replacement contact on every startup.
This marker is a proposed resolution of L2-013's contact-edit preservation rule, not a restriction on contact CRUD.
Each seed change registers a success audit with `AddAuditEvent` in the same seed transaction (L2-039): `Administrator created` for a new account, `Administrator access restored` when a repair changes the names, the active flag, or the role, and `City contact seeded` when the City contact is added.
Each event carries a null actor, because no user made the request, the run's correlation ID from `EnsureRequiredSeedsCommand`, the entity type and ID, the outcome `Succeeded`, and the area `Accounts` or `Leads`. A run that changes nothing, including adopting an existing contact unchanged, records nothing.
`SaveChangesAsync(ct)` then commits the account, any new contact, the marker, and their audit events atomically; any failure leaves none of them.

`HealthController` is a thin controller in `MissionControl.Api.Controllers`. It answers `GET /health/live` directly and dispatches `GetReadinessQuery` for `GET /health/ready`.
`GET /health/live` reports `200` while the process runs. `GET /health/ready` reports `200` only after schema, SQL access, and administrator initialization succeed.
`GetReadinessQueryHandler` reads `InitializationStatus` first; once it is `Ready`, it calls `IDatabaseReadinessProbe.CheckAsync(ct)` to confirm SQL access and a compatible schema on each probe.
Initialization still running, loss of SQL, or incompatible schema returns `503` for readiness without connection strings or secret values.
`DatabaseInitializer` is the only startup check of signing material (L2-036.2). It reads `IOptions<JwtOptions>` and checks the signing material before taking the lock; missing or invalid material records `Failed`, so readiness answers `503` while the host keeps running for diagnosis instead of stopping.
`JwtAccessTokenIssuer` uses the same options and has no fallback key, so no token is ever issued with fallback material.
Failed initialization remains visibly unready and records a correlation ID, operation, outcome, and UTC diagnostic time. The operator corrects the cause and restarts the instance.
Concurrent initialization and restore checks run against the eventual chosen SQL provider; an in-memory substitute cannot prove locking or uniqueness behavior.

| Behavior | Proposed boundary | Proposed operation |
| --- | --- | --- |
| Migrate and seed | `MissionControl.Api` host startup (`DatabaseInitializer` background service) | `EnsureRequiredSeedsCommand` / `EnsureRequiredSeedsCommandHandler` |
| Observe liveness and readiness | `GET /health/live; GET /health/ready` | `GetReadinessQuery` / `GetReadinessQueryHandler` with `IDatabaseReadinessProbe` |

Mock input and review references:

- [Home · Mission Control mock](../../../mocks/home/home.html); review states: `default`, `collaborator`, `first-run-admin`, `first-run-collaborator`, `no-active-sprints`, `loading`, `error`, `section-error`.
- [Account details · Mission Control mock](../../../mocks/admin/account-detail.html); review states: `default`, `designated`, `inactive`, `not-found`, `loading`, `error`.
- [Lead details · Mission Control mock](../../../mocks/leads/lead-detail.html); review states: `default`, `lead`, `lead-rafael`, `lead-lucia`, `saved`, `collaborator`, `not-found`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-006` | `L1-002` | After migrations and successful initialization, the application must contain an active highest-capability administrator named Quinntyne Brown with normalized email `quinntynebrown@gmail.com`. The initial configured password must be `MissionCtrl2026!` and must be stored only as a hash in SQL. |
| `L2-007` | `L1-002` | The seed must avoid duplicates, preserve existing passwords and restore the designated account's active status and highest capabilities. |
| `L2-008` | `L1-002` | Application operations must not delete, deactivate, demote, or change the email identity of the designated administrator. Its password can be replaced securely. |
| `L2-013` | `L1-003` | Initial seeding must create a separate City contact for Quinntyne Brown at the designated email with no phone supplied. Existing matching City contacts must not be duplicated or have later contact edits reset by startup. |
| `L2-036` | `L1-010` | Passwords must be stored using a maintained password-hashing mechanism with per-password salts. JWT signing material and bootstrap secrets must come from external configuration. Production authentication must use HTTPS. Tokens must not be persisted in browser local/session storage, URLs, or contact data. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |
| `L2-042` | `L1-012` | Deployment must support repeatable migrations followed by required seeding. Readiness must succeed only after required schema, SQL access, and administrator initialization succeed. Liveness must distinguish an alive process from readiness. |
| `L2-043` | `L1-012` | The API must return a correlation ID for unexpected failures and write structured diagnostic records containing operation, UTC time, outcome, and that same ID. Users must receive useful error categories without internal stack traces or secret values. Production logs and diagnostics must be restricted operational data. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Initialize and protect the administrator: c4 context](diagrams/c4-context.png)

The container view shows initialization running inside the `MissionControl.Api` host, its external configuration, and the durable SQL environment.

![Initialize and protect the administrator: c4 container](diagrams/c4-container.png)

The component view locates the startup background service, the initialization lock, the seed handler with its audit registration, and the readiness probe.

![Initialize and protect the administrator: c4 component](diagrams/c4-component.png)

The class view identifies the background service, its options, signing-material check, and lock, the seed command with its data-session members and audit events, and the readiness query and probe.

![Initialize and protect the administrator: class structure](diagrams/class-structure.png)

Migrate and seed follows the sequence below. The flow traces its enforcing steps to `L2-006` and `L2-039` and includes rejection or recovery paths, with the health endpoints answering while it runs.

![Migrate and seed](diagrams/sequence-initialize.png)

Observe liveness and readiness follows the sequence below. The flow traces its enforcing steps to `L2-042` and includes rejection or recovery paths.

![Observe liveness and readiness](diagrams/sequence-health.png)

