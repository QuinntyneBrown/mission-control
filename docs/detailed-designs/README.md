# Mission Control detailed designs

## Overview

Mission Control coordinates FaithTech Toronto lead contacts and project delivery through a .NET API and Angular web client.
This design tree refines [L1 scope](../specs/L1.md), the [L2 baseline](../specs/L2.md), the [PRD](../PRD.md), and [workflow mocks](../mocks/index.html).
The repository contains design inputs, not production application code. Named production parts below are proposed designs.
Each feature page contains its scope, concrete parts, verbatim L2 requirements with L1 parents, and rendered PlantUML views.

## Description

The subsystem names derive from the flat L1/L2 set: `identity`, `leads`, `projects`, `work`, `kanban`, `scrum`, `workspace`, `operations`, and `artifacts`.
The first seven contain user-facing vertical slices; operations cover initialization, recovery, and release measurement. Artifact slices document independent static review deliverables.

| Layer / project | Proposed responsibility and dependency |
| --- | --- |
| `backend/src/MissionControl.Domain` | Entities, value rules, and enums; references no other project. |
| `backend/src/MissionControl.Application` | Per-feature commands, queries, MediatR `12.5.0` handlers, validators, and data/security ports; references Domain. |
| `backend/src/MissionControl.Infrastructure` | SQL adapters, hashing, token issuance, initialization, and diagnostics; implements Application ports. |
| `backend/src/MissionControl.Api` | Composition, authentication/authorization middleware, thin controllers, ProblemDetails, and health endpoints; no business logic in controllers. |
| `backend/src/MissionControl.Operations`, `e2e/performance` | Release tooling, not acceptance suites. The .NET console (Microsoft.Extensions DI, Options, Configuration) captures and restores backups and measures API load over HTTP; it references no other Mission Control project. The Playwright-library script times cold Chromium views against the production build. Records go to `docs/operations/`. |
| `backend/tests` | API integration acceptance checks against the selected SQL provider; initialization and concurrency checks use real transactional SQL. |
| `frontend/projects/api` | Singular `I<Entity>Service` contracts and tokens together in `<entity>.service.contract.ts`; separate unprefixed HTTP implementations and `<entity>.service.mock.ts` mock adapters. |
| `frontend/projects/domain` | Service-consuming rendering components inject tokens and hold state in signals; no HTTP calls. |
| `frontend/projects/components` | Presentational inputs/outputs only; no application services or imports from sibling projects. |
| `frontend/projects/mission-control` | Routed pages, guards, application dialogs, and composition. Dependencies run application → domain → api; presentational components remain independent. |
| `design-system/` | Independent package/build/static deployment and authoritative `--mc-` token copy; no application runtime dependency. |
| `e2e/page-objects`, `e2e/specs` | Chromium-only Playwright acceptance workflows against the `e2e` mock build; page objects own selectors and interactions. |

Every backend type has its own matching file and namespace. Frontend component class, template, and stylesheet remain separate.
Consumers inject interface tokens only. Each HTTP adapter (`<entity>.service.ts`) and its mock adapter (`<entity>.service.mock.ts`) are separate files in `frontend/projects/api`; no consumer imports either.
The application's providers file binds every token to its HTTP adapter. An `e2e` Angular build configuration replaces that file through `fileReplacements` with one binding each token to its mock.
Playwright acceptance specs in `e2e/specs` run only against the `e2e` build, so a spec never reaches a real adapter.
HTTP and observable-to-signal conversion stay in `api`; domain state uses signals. Microsoft.Extensions provides DI, Options, and Configuration.

The request path is API middleware → bound controller request → MediatR validation → feature handler → domain/data port → Infrastructure SQL.
JWT verification checks issuer, audience, subject, signature, and expiry; current SQL account status, role, and credential version remain authoritative.
Typed responses exclude secrets. Validation V preserves its `400`, `401`, `403`, `404`, and `409` categories; unexpected `500` includes a safe correlation ID.
Read DTOs are separate from entities; credential fields never serialize through ordinary account responses.
Tables and interfaces in feature diagrams are scoped views, not additional copies of shared types.

The diagrams name `FeatureResult`, `FeatureState`, and `ReadResult` as schematic type families, not a universal production response class.
Each implemented request receives a specific typed result matching its endpoint; list results carry items, total matching count, page, and page size.
Mutation results carry stable ID and new version where relevant; `204` is suitable for a committed deletion.
Client feature-state variants distinguish loading, ready, empty, failed, and pending mutation states without conflating empty data and request failure.

| SQL record / constraint | Purpose |
| --- | --- |
| `UserAccount`; unique normalized email | Account identity, salted hash, active flag, role, credential version, concurrency version. |
| `LeadContact`; unique normalized email/category | Contact identity independent of account identity; five-category enum and optional phone. |
| `Workspace`; restrictive lead FK | Project mode, responsible contact, version, and serialized workspace transaction/order boundary. |
| `WorkItem`; composite typed same-workspace parent FK | Fixed Initiative → Epic → Story → Task hierarchy, optional user assignment, nullable fields, version. |
| Sibling and `StoryBacklogPosition` unique ordered keys | Independent deterministic sibling and workspace priority orders. |
| `BoardState`, `BoardPlacement` | Versioned Kanban/sprint card order; story status remains authoritative on WorkItem. |
| `Sprint`, `ActiveSprintSlot` | Planned/Active/Closed lifecycle and unique active workspace slot. |
| `OpenSprintMembership`; unique story ID | One live planned/active sprint per story; tasks derive membership. |
| Initial scope, `SprintScopeChange`, `SprintSnapshot`, `SprintStoryOutcome` | Immutable initial IDs, explicit active-scope changes, and closure facts independent of live work deletion. |
| `AuditEvent` | Immutable operation metadata; success audit and business change share one transaction. |
| `LoginAttempt`, initialization marker | Atomic normalized-email throttle and one-time City contact seed tracking. |

Application data ports expose bounded query specifications and transactional changes; Infrastructure owns SQL parameterization and constraint-error translation.
Versioned writes use `WHERE Id = ... AND Version = expectedVersion` or equivalent provider-native conditions and return `409` when stale.
Edit forms submit the version they opened. On a stale-version `409` the form keeps the attempted values and reads the latest version once (no resubmission).
Reload latest adopts the latest values and version while the "Your edit" / "Latest saved" comparison stays visible. Conflict copy is neutral, without person or time attribution.
Deletes carry no expected version; L2-041 versions edits. Delete handlers re-check the L2 rules (children, open sprint membership, references, history) inside the workspace or record transaction before deleting.
A delete of a missing record returns `404`; the UI closes the dialog, reloads the list without the record, and announces that it was already deleted.
Marking a story Done with unfinished tasks returns `409` with category `unfinished-tasks` and the current unfinished count.
Any board or the story detail then opens `UnfinishedTasksDialog`, an application dialog in `frontend/projects/mission-control` that shows the count only.
Mark story Done resubmits the same command with the returned `StoryCompletionCondition`; Keep restores the saved view and sends nothing.
Workspace mutations acquire the same workspace transaction lock before hierarchy/order, board, mode, or sprint state changes.
The lock provides a simple initial correctness boundary; L2-046 measurement evaluates its performance under the proposed workload.
Multi-record changes include their success audit before commit. Expected constraint races translate to validation/conflict results, and failed transactions leave no successful audit.
Denials, throttles, and rejected protected or permission changes append a `Rejected` audit event through the restricted append operation, outside any rolled-back business transaction.
Those events carry no secret or contact payloads. Diagnostics are restricted operational data.

Pagination defaults to 25 and caps at 100. Board/hierarchy batches cap at 100; full counts precede paging.
Stable ID tie-breakers avoid ambiguous ordering under unchanged data. Filter changes reset the first page; adapters ignore superseded read responses.
Optimistic moves keep a saved snapshot. Stale-version and rule conflicts reload persisted state before another explicit mutation; the unfinished-tasks `409` instead opens its confirmation.
Uncertain transport failures read persisted state before retry.
There is no automatic mutation retry that claims a failed request did not commit.

Responsive profile R covers seven widths from 320 through 1920 CSS pixels at 800 pixels high.
All production slices inherit responsive, field-feedback, keyboard, label, contrast, touch, and zoom behavior from L2-030–L2-035.
Those requirements appear in representative feature tables and apply to every UI acceptance flow, even where not repeated in a table.
The mocks provide static state/interaction evidence; backend constraints and API errors remain authoritative.

| Retained decision | Design status |
| --- | --- |
| Roles, lead cardinality/validation, Scrum rules, in-memory 30-minute sessions, WCAG target, performance profile | Proposed L2 baseline; this design does not promote these defaults to confirmed product decisions. |
| SQL provider and versions of .NET, Angular, SQL, and tooling | `<TO SUPPLY>` before dependent implementation. |
| Hosting topology, production HTTPS, configured CORS origins, signing algorithm/key source, secret-management facility | `<TO SUPPLY>` before authentication/deployment implementation. |
| Hash adapter algorithm parameters and provider-specific migration/order/transaction locking | `<TO SUPPLY>` before security/persistence implementation. |
| Backup commands, storage access, schedule, retention, responsible operator, restore commands, and latest rehearsal | `<TO SUPPLY>` in `docs/operations/recovery-runbook.md` before release. |
| Release measurement composition | L2-046.2 cold-view runs use the production HTTP composition against the isolated fixture, kept separate from `e2e/specs`; all acceptance specs keep the mock composition. |
| Design-system build/hosting commands and maintainer | `<TO SUPPLY>` before independent artifact delivery. |
| Project-local display keys such as `HCK-112` | Mock representation; allocation policy `<TO SUPPLY>`, separate from stable required IDs. |
| City seed completion marker, all-account email immutability, preserved Kanban Sprints tab | Explicit design proposals explained in the relevant feature pages; no silent specification amendment. |

Framework/provider choices remain explicit gaps because the inputs do not establish them. No release-recovery or measured-performance result is claimed.
Deferred PRD capabilities, including messaging, public registration, external identity, and multi-city tenancy, remain outside this design.

Production implementation proceeds one behavior at a time: linked Given-When-Then criteria, expected red API/Chromium acceptance check, minimal implementation, green regression checks.
Mocks, this documentation, and the design system remain design artifacts; no ATDD, artifact tests, or architecture tests are introduced.
The requirements tables retain exact source wording, including `must`; authored design prose uses declarative statements and `shall/should/may` for obligations.

## Requirements

Every L2 appears below with its defining feature; cross-cutting requirements also occur in the feature pages where they apply.

| L2 | Refines | Feature designs |
| --- | --- | --- |
| `L2-001` — Credential login | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md) |
| `L2-002` — JWT validation and current access | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md) |
| `L2-003` — Session expiry and logout | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-004` — Administrative account management | `L1-001` | [Provision and manage accounts](identity/manage-accounts/README.md) |
| `L2-005` — Permission enforcement and contact/account separation | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Provision and manage accounts](identity/manage-accounts/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Review home coverage and progress](workspace/review-home/README.md) |
| `L2-006` — Initial administrator bootstrap | `L1-002` | [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-007` — Repeatable and repairing administrator seed | `L1-002` | [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-008` — Protect the designated administrator | `L1-002` | [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-009` — Create and validate lead contacts | `L1-003` | [Create and edit lead contacts](leads/maintain-contacts/README.md) |
| `L2-010` — Lead directory, details, search, and filtering | `L1-003` | [Find and read lead contacts](leads/find-contacts/README.md) |
| `L2-011` — Edit lead contacts | `L1-003` | [Create and edit lead contacts](leads/maintain-contacts/README.md) |
| `L2-012` — Delete leads without unrelated data loss | `L1-003` | [Delete an unreferenced lead contact](leads/delete-contact/README.md) |
| `L2-013` — Identify the City Lead | `L1-003` | [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Find and read lead contacts](leads/find-contacts/README.md) |
| `L2-014` — Project workspace management | `L1-004` | [Create and manage project workspaces](projects/manage-workspaces/README.md) |
| `L2-015` — Create and navigate the work hierarchy | `L1-004` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md) |
| `L2-016` — Edit, assign, and reparent work | `L1-004` | [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md) |
| `L2-017` — Stable prioritization and backlog ordering | `L1-004` | [Prioritize siblings and the story backlog](work/prioritize-work/README.md) |
| `L2-018` — Safe work-item deletion | `L1-004` | [Delete permitted leaf work](work/delete-leaf-work/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md) |
| `L2-019` — Kanban board and story details | `L1-005` | [View the Kanban story board](kanban/view-story-board/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-020` — Persisted and accessible Kanban moves | `L1-005` | [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-021` — Explicit story completion with unfinished tasks | `L1-005` | [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-022` — Plan sprints and allocate stories | `L1-006` | [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md) |
| `L2-023` — Start and manage the active sprint | `L1-006` | [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md) |
| `L2-024` — Execute work on the sprint board | `L1-006` | [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-025` — Close sprints and resolve unfinished work | `L1-006` | [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md) |
| `L2-026` — Preserve and display sprint history | `L1-006` | [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-027` — Change delivery mode safely | `L1-006` | [Change workspace delivery mode](projects/change-delivery-mode/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md) |
| `L2-028` — Accurate home summaries | `L1-007` | [Review home coverage and progress](workspace/review-home/README.md) |
| `L2-029` — Contextual navigation and direct routes | `L1-007` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-030` — Responsive application workflows | `L1-008` | [Find and read lead contacts](leads/find-contacts/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-031` — Reliable form submission and destructive confirmations | `L1-008` | [Provision and manage accounts](identity/manage-accounts/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-032` — Empty, loading, error, and visual feedback states | `L1-008` | [Find and read lead contacts](leads/find-contacts/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md), [Review the standalone design language](artifacts/review-design-language/README.md) |
| `L2-033` — Keyboard operation and focus management | `L1-009` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-034` — Accessible labels, structure, and announcements | `L1-009` | [Find and read lead contacts](leads/find-contacts/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-035` — Contrast, zoom, touch, and non-color meaning | `L1-009` | [View the Kanban story board](kanban/view-story-board/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md), [Review the standalone design language](artifacts/review-design-language/README.md) |
| `L2-036` — Credential, token, and secret protection | `L1-010` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-037` — Safe input handling and API boundaries | `L1-010` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md) |
| `L2-038` — Authentication abuse throttling | `L1-010` | [Sign in and end a session](identity/sign-in-and-end-session/README.md) |
| `L2-039` — Audit security and data mutations | `L1-010` | [Provision and manage accounts](identity/manage-accounts/README.md), [Review security and mutation audit events](identity/review-audit-events/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md) |
| `L2-040` — Durable, atomic business changes | `L1-011` | [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Change workspace delivery mode](projects/change-delivery-mode/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md), [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-041` — Conflict detection and relational constraints | `L1-011` | [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Change workspace delivery mode](projects/change-delivery-mode/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md) |
| `L2-042` — Repeatable initialization and health status | `L1-012` | [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-043` — Diagnosable errors and request correlation | `L1-012` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Review security and mutation audit events](identity/review-audit-events/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-044` — Backup and restore readiness | `L1-012` | [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-045` — Bounded collection loading | `L1-013` | [Review security and mutation audit events](identity/review-audit-events/README.md), [Find and read lead contacts](leads/find-contacts/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Measure release workflow performance](operations/measure-release-performance/README.md) |
| `L2-046` — Measurable initial performance budgets | `L1-013` | [Measure release workflow performance](operations/measure-release-performance/README.md) |
| `L2-047` — Standalone design system artifact | `L1-014` | [Review the standalone design language](artifacts/review-design-language/README.md) |
| `L2-048` — Workflow mock artifacts | `L1-014` | [Review workflow mock artifacts](artifacts/review-workflow-mocks/README.md) |

## Diagrams

Each feature includes context, container, component, class, and behavior sequence views. Each PlantUML source has a rendered PNG sibling.

| Subsystem | Feature page |
| --- | --- |
| `identity` | [Sign in and end a session](identity/sign-in-and-end-session/README.md) |
| `identity` | [Provision and manage accounts](identity/manage-accounts/README.md) |
| `identity` | [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `identity` | [Review security and mutation audit events](identity/review-audit-events/README.md) |
| `leads` | [Create and edit lead contacts](leads/maintain-contacts/README.md) |
| `leads` | [Find and read lead contacts](leads/find-contacts/README.md) |
| `leads` | [Delete an unreferenced lead contact](leads/delete-contact/README.md) |
| `projects` | [Create and manage project workspaces](projects/manage-workspaces/README.md) |
| `projects` | [Change workspace delivery mode](projects/change-delivery-mode/README.md) |
| `work` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md) |
| `work` | [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md) |
| `work` | [Prioritize siblings and the story backlog](work/prioritize-work/README.md) |
| `work` | [Delete permitted leaf work](work/delete-leaf-work/README.md) |
| `kanban` | [View the Kanban story board](kanban/view-story-board/README.md) |
| `kanban` | [Move and reorder story cards](kanban/move-story-cards/README.md) |
| `kanban` | [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md) |
| `scrum` | [Plan sprints and allocate stories](scrum/plan-sprints/README.md) |
| `scrum` | [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md) |
| `scrum` | [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `scrum` | [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md) |
| `scrum` | [Read immutable sprint history](scrum/read-sprint-history/README.md) |
| `workspace` | [Review home coverage and progress](workspace/review-home/README.md) |
| `workspace` | [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `operations` | [Rehearse backup and restore](operations/restore-data/README.md) |
| `operations` | [Measure release workflow performance](operations/measure-release-performance/README.md) |
| `artifacts` | [Review the standalone design language](artifacts/review-design-language/README.md) |
| `artifacts` | [Review workflow mock artifacts](artifacts/review-workflow-mocks/README.md) |

Rendering uses the software-design-document skill renderer and local PlantUML with offline C4 includes.
