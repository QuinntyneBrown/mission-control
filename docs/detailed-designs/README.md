# Mission Control detailed designs

## Overview

Mission Control coordinates FaithTech Toronto lead contacts and project delivery through a .NET API and Angular web client.
This design tree refines [L1 scope](../specs/L1.md), the [L2 baseline](../specs/L2.md), the [PRD](../PRD.md), and [workflow mocks](../mocks/index.html).
The repository contains design inputs, not production application code.
Each feature page contains its scope, concrete parts, verbatim L2 requirements with L1 parents, and rendered PlantUML views.
Feature pages link to the [shared design rules](#shared-design-rules) instead of repeating them.

## Description

The subsystem names derive from the flat L1/L2 set: `identity`, `leads`, `projects`, `work`, `kanban`, `scrum`, `workspace`, `operations`, and `artifacts`.
The first seven contain user-facing vertical slices; operations cover backup/restore rehearsal and release measurement; startup initialization is designed in `identity/initialize-administrator`. Artifact slices document independent static review deliverables.

### Shared design rules

Each cross-cutting rule is stated once, here. A feature page records only its feature-specific behavior and names any exception next to the behavior it changes.

#### Status and scope

All named production parts are proposed designs; the repository contains requirements, designs, and static mocks.
Proposed L2 defaults keep their proposal status, and the [retained decisions](#retained-decisions-and-gaps) stay open until recorded.
Tables and interfaces in feature diagrams are scoped views of the shared types below, not additional copies.
Requirement tables quote L2 verbatim, including `must`; authored design prose uses declarative statements and `shall/should/may` for obligations.

#### Placement and backend conventions

| Layer / project | Proposed responsibility and dependency |
| --- | --- |
| `backend/src/MissionControl.Domain` | Entities, value rules, and enums; references no other project. |
| `backend/src/MissionControl.Application` | Per-feature commands, queries, handlers, validators, and data/security ports; references Domain. |
| `backend/src/MissionControl.Infrastructure` | SQL adapters, hashing, token issuance, initialization, and diagnostics; implements Application ports. |
| `backend/src/MissionControl.Api` | Composition, authentication and the `CurrentAccountAuthorization` access check, thin controllers, ProblemDetails, and health endpoints. |
| `backend/src/MissionControl.Operations`, `e2e/performance` | Release tooling, not acceptance suites. The .NET console captures and restores backups and measures API load over HTTP; it references no other Mission Control project. The Playwright-library scripts time Chromium views against the production build. Records go to `docs/operations/`. |
| `backend/tests` | API integration acceptance checks against the selected SQL provider; initialization and concurrency checks use real transactional SQL. |
| `frontend/projects/api` | Service contracts with their tokens, the shared `ResourceRef<T>` type, HTTP adapters, mock adapters, and the session adapter (`SessionService`, `sessionInterceptor`). |
| `frontend/projects/domain` | Service-consuming rendering components; they inject tokens, own their read resources and view state in signals, and make no HTTP calls. |
| `frontend/projects/components` | Presentational inputs/outputs only; no application services or imports from sibling projects. |
| `frontend/projects/mission-control` | Routed pages, guards, application dialogs, and composition. Dependencies run application → domain → api; presentational components remain independent. |
| `design-system/` | Independent package/build/static deployment and authoritative `--mc-` token copy; no application runtime dependency. |
| `e2e/page-objects`, `e2e/specs` | Chromium-only Playwright acceptance workflows against the `e2e` mock build; page objects own selectors and interactions. |

Every class, interface, record, and enum has its own file named for the type; folders and namespaces agree.
Commands, queries, handlers, and request validators live in Application feature folders. MediatR stays pinned to `12.5.0`.
Controllers live in `Controllers` with namespace `MissionControl.Api.Controllers`; each binds, dispatches through MediatR, and returns, with no business logic.
Microsoft.Extensions supplies dependency injection, Options, and Configuration to the API and the operations console.

#### API boundary and errors

The request path is API middleware → bound controller request → MediatR validation → feature handler → domain/data port → Infrastructure SQL.
Every endpoint except sign-in and the health endpoints requires authentication.
On each protected request, `CurrentAccountAuthorization` in `MissionControl.Api` validates the JWT's issuer, audience, subject, signature, and expiry.
Before feature dispatch it reads the account's current status, role, and credential version through `LoadAccountAccessAsync(accountId, ct)`, and it appends `Denied` through `IAuditEventWriter` when it refuses access, taking the area, operation, entity type, and entity ID from audit metadata each controller action declares beside its capability policy (the entity ID from a named route parameter), because no feature handler has run.
L2 permission profile P decides access; [capabilities](#capabilities-and-permissions) name the operations that need more than an active session.
Validation V maps invalid fields to `400` with field messages, absent or invalid authentication to `401`, forbidden access to `403`, missing records to `404`, and conflicts to `409`.
Path IDs carry a `{id:guid}` route constraint, so a malformed path ID matches no route and returns `404`; a malformed identifier in a body or query string returns `400`.
A project-tab view whose read can miss either the workspace or its own record (the work item detail) gets a `404` carrying the category `workspace-not-found` or `item-not-found`, because the handler looks up the workspace first; the view then tells a deleted project, which refreshes the layout, from a deleted record. A work read's `parentId` that names no item matches nothing and returns an empty page, not `404`; the project list's `responsibleLeadId` differs because its result echoes the lead's name, so an unknown lead returns `400` (`lead-filter-invalid`).
Unexpected errors return a generic `500` with a correlation ID. Every response carries its request's correlation ID in the `X-Correlation-ID` header.
Structured diagnostics are restricted operational data and exclude secrets, tokens, connection strings, and contact payloads.
Read DTOs are separate from entities; credential fields never serialize through ordinary account responses.

The diagrams name `FeatureResult`, `FeatureState`, and `ReadResult` as schematic type families, not a universal production response class.
Each endpoint shape has its own query and typed result; a list endpoint and a detail endpoint never share a query.
For example, `ListAccountsQuery` returns `AccountSummaryPage` and `GetAccountQuery { id }` returns the account detail; `ListSprintsQuery` returns the sprints tab result and `GetSprintPlanQuery { workspaceId, sprintId }` returns the plan header.
List results carry items, total matching count, page, and page size.
Mutation results carry stable ID and new version where relevant; `204` is suitable for a committed deletion.

Types shared across features keep one name and shape:

- `SprintStatus { Planned, Active, Closed }` is the only sprint lifecycle enum.
- `SprintReference { sprintId, name }` refers to a sprint; `SprintPeriod { sprintId, name, startDate, endDate }` adds its dates on home.
- `ResponsibleWorkspace { id, name, mode }` serves both lead detail and the lead-delete conflict.
- `CategoryCount { category, count }` serves both home lead coverage and the directory totals.

#### Data access and security ports

`IMissionControlDataSession` is the single Application data port, defined here; Infrastructure implements it with parameterized SQL and translates constraint errors.

- **Typed feature reads.** Each feature read is its own member taking that query's parameters and a `CancellationToken`: `Load…Async(…, ct)` returns one record, aggregate, or projection, and `List…Async(…, ct)` returns a bounded list or page. Each loaded entity is tracked with the expected version its command supplies, or else the version it was read at. There is no generic specification or repository framework.
- **Tracked inserts and deletes.** Typed members `Add<Entity>(entity)` and `Remove<Entity>(entity)`, for example `AddLead` and `RemoveWorkspace`, exist for aggregate roots only and register inserts and deletes on the scoped session. Child rows owned by an aggregate loaded through `Load…Async` have no such members: `SaveChangesAsync(ct)` writes their additions, changes, and removals as tracked children of that aggregate.
- **`AddAuditEvent(AuditEvent auditEvent)`.** Registers a success audit on the scoped session. `SaveChangesAsync(ct)` commits it in the same transaction as the change it records, so a failed transaction leaves no success audit.
- **`Task BeginWorkspaceTransactionAsync(Guid workspaceId, CancellationToken ct)`.** Opens the transaction and acquires the workspace lock before any other read or write in it. It returns `Task`: the scoped session owns the open transaction and the lock until `SaveChangesAsync(ct)` commits, and disposing the scoped session without committing rolls back.
- **`Task SaveChangesAsync(CancellationToken ct)`.** Writes every tracked change under its expected-version condition (`WHERE Id = ... AND Version = expectedVersion` or a provider-native equivalent) and commits the open transaction. Any stale version rolls the whole transaction back and raises one typed `ConcurrencyConflictException`, which the API maps to `409`. Changes outside a workspace, such as accounts and contacts, commit through this call alone in one transaction.

`IAuditEventWriter.AppendRestrictedAsync(AuditEvent auditEvent, CancellationToken ct)` appends `Denied`, `Throttled`, and `Rejected` events outside any business transaction, so a rollback never removes them.
Denied access, throttled sign-in, and rejected protected or permission changes use it. No audit event carries a secret or contact payload.
Every asynchronous handler and port member takes a `CancellationToken`. Cancellation before commit leaves no change, and a cancelled call never proves that a commit did not happen.
Feature class views show only the methods that feature uses and introduce no other signatures.
Passwords and tokens go through two Application ports: `IPasswordHashService` hashes and verifies passwords, and `IAccessTokenIssuer` issues access tokens; `LoginCommandHandler` uses both.
Their Infrastructure adapters own the hash algorithm settings and `JwtOptions`; `UserAccount` holds no hashing logic.
Startup seeding is one `EnsureRequiredSeedsCommand`, which owns the seed transaction for the administrator, the City contact, and the initialization marker and commits once through `SaveChangesAsync(ct)`.
Initialization runs as a `BackgroundService` (`ExecuteAsync`), so the host serves `/health/live` (`200`) and `/health/ready` (`503` while Initializing) during the run; seeding audits its changes through `AddAuditEvent` with a null actor and the run's correlation ID.
Readiness checks the database through the named port `IDatabaseReadinessProbe`; [Initialize and protect the administrator](identity/initialize-administrator/README.md) holds the detail.

#### Persistence, concurrency, and audit

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
| `AuditEvent` | Immutable operation metadata, written as described under [data access and security ports](#data-access-and-security-ports). |
| `LoginAttempt`, initialization marker | Atomic normalized-email throttle and one-time City contact seed tracking. |

Edit forms submit the version they opened. On a stale-version `409` the form keeps the attempted values and reloads its record resource once to read the latest version (no resubmission).
Reload latest adopts the latest values and version while the "Your edit" / "Latest saved" comparison stays visible. Conflict copy is neutral, without person or time attribution.
Deletes carry no expected version; L2-041 versions edits. Delete handlers re-check the L2 rules (children, open sprint membership, references, history) inside the workspace or record transaction before deleting.
A delete of a missing record returns `404`; the UI closes the dialog, reloads the list without the record, and announces that it was already deleted, or, when the dialog had relayed `unconfirmed` for an earlier delete, neutrally that the named record has been deleted, since that first request may have deleted it.
Marking a story Done with unfinished tasks returns `409` with category `unfinished-tasks` and the current unfinished count. A task change increments only its story's `taskRevision`, not the story's or a sprint's version, so a resubmission passes the version check and meets a changed condition as a new `unfinished-tasks` `409`.
Any board, the story detail, or the story edit form then opens `UnfinishedTasksDialog`, an application dialog in `frontend/projects/mission-control` that shows the count only.
Mark story Done resubmits the same command with the returned `StoryCompletionCondition`; Keep restores the saved view and sends nothing, and a navigation that closes the dialog with no result is treated as Keep (the opener relays `kept`).

Every change to a workspace's hierarchy/order, board, mode, or sprint state calls `BeginWorkspaceTransactionAsync` first, so the workspace lock precedes every other read or write in that transaction.
The lock is held only for that mutation's transaction. A wait beyond the configured lock timeout returns `503` with `Retry-After` and no partial change.
The UI treats that `503` as an unavailable save: it restores the latest acknowledged view, keeps any draft, and offers retry.
The lock provides a simple initial correctness boundary; [release measurement](operations/measure-release-performance/README.md) evaluates its cost.
Expected constraint races translate to validation or conflict results.

Optimistic changes restore the latest acknowledged saved state on failure, never an older snapshot.
Stale-version and rule conflicts reload persisted state before another explicit mutation; the unfinished-tasks `409` instead opens its confirmation.
An uncertain outcome, such as a timeout or network failure, follows the uncertain-mutation rule under [failure presentation](#failure-presentation).
Mutations are never debounced and never retried automatically.

#### Reads and queries

Pagination defaults to 25 and caps at 100. Board/hierarchy batches cap at 100; full counts come from the API, never from rendered rows.
Stable ID tie-breakers avoid ambiguous ordering under unchanged data. Filter changes reset to the first page.
A list response computes its rows and total in one statement (a window count) or inside an explicit snapshot-isolation read transaction.
Each home section is one response with its own consistent snapshot; different sections may represent different instants.
The provider-specific isolation choice is made at the SQL-provider gate; transactions are not raised to Serializable by default.
List and card DTOs omit long descriptions. Task counts are set-based aggregates, never per-card queries; live-title lookups for history are batched.
Typed search debounces about 250 ms on the consumer's query signal before the query reaches its resource; explicit filter and page actions change the query at once.
A newer query from the same consumer supersedes the older one: when the query signal changes, the resource aborts the superseded HTTP request inside the adapter, so a late response never replaces newer results.

#### Frontend composition

Consumers call `inject(<ENTITY>_SERVICE)` only. Each singular `I<Entity>Service` contract and its `InjectionToken` live together in `<entity>.service.contract.ts`.
The unprefixed HTTP adapter (`<entity>.service.ts`) and the mock adapter (`<entity>.service.mock.ts`) are separate files in `frontend/projects/api`; no consumer imports either.
The application's providers file binds every token to its HTTP adapter. An `e2e` Angular build configuration replaces that file through `fileReplacements` with one binding each token to its mock.
A mock adapter implements the same contract over fixture data, returning resources for reads and promises for mutations.
Playwright acceptance specs in `e2e/specs` run only against the `e2e` build, so a spec never reaches a real adapter.

#### Frontend data ownership

HTTP calls and RxJS stay inside the `api` adapters; no RxJS type crosses the `api` boundary. A service contract has two kinds of member.

- **Reads return a caller-owned signal resource.** `ResourceRef<T>`, defined once in `api`, exposes `value`, `status` (`loading`, `resolved`, or `error`), and `error` signals plus `reload()`. A read member takes its query as a function, for example `boardResource(query: () => BoardQuery | undefined): ResourceRef<BoardResult>`; an `undefined` query sends nothing. Route guards are the one exception: they run before any component exists, so they read through promise members (`PermissionGuard` through `refreshCapabilities()`, `BoardModeGuard` through `IWorkspaceService.loadMode(workspaceId)`).
  The consumer calls the member in its own injection context (a field initializer), so the adapter creates the resource there. The adapter performs the `HttpClient` call and converts it to signals. When the query signal changes it aborts the superseded request, and when the consumer is destroyed it cancels any read in flight. `reload()` repeats the current query.
- **Mutations return `Promise<TResult>`.** The adapter converts the observable inside `api`. The owning view updates its own signals from the result and reloads the affected resources.

Apart from `SessionService` and `ToastService` ([Session handling](#session-handling)), adapters hold no shared mutable state. Each consumer owns its own resources and state signals, so one consumer's load or failure never changes another consumer's results; derived projections use `computed`.
A resource's `status` and `error` feed the feature-state variants, which distinguish loading, ready, empty, failed, and pending-mutation states without conflating empty data and request failure.
Drafts live in the owning form. Application dialogs exchange data with domain components through inputs and outputs only.
Actions rendered by the domain view that owns the data (header buttons such as Edit details or Start sprint, row actions, banners, and empty-state buttons) emit `<action>Requested` outputs carrying the IDs, or the loaded row or details, that the action needs, for example `deleteRequested(lead)` with the row `LeadDeleteDialog` names; the routed page maps each output to its dialog opener or navigation.
Every application dialog closes through `close(result?)` with a typed union `<Dialog>Outcome` listing each outcome its opener reacts to: committed, not found or outdated, or a redirect such as `ChangeMode` or `CloseSprint(SprintReference)`. Closing with no result means it was dismissed. While open, a dialog relays its form's `unconfirmed` (a save or delete that got no response) and `forbidden` (an unexpected `403`) outputs and stays open; an administrator-only dialog with a designed `403` presentation relays no `forbidden`.
A dialog also closes with no result once a navigation completes that deactivates the page hosting it or changes that page's route parameters (both run its `UnsavedChangesGuard`), whether through a router link inside it (such as View existing lead or View sprints), browser Back or Forward, or the navigation to login; that page's `UnsavedChangesGuard` has already seen the dialog's draft through its `FormDraft` delegation.
Angular runs `canDeactivate` only for a route the navigation deactivates, so for a dialog `ProjectLayoutPage` opens, the hosting page is the active child page, whose `draft` falls back to the layout's open dialog; the layout defers its own re-navigation (`modeChanged()` and the `sprints` redirect) until its dialog closes. A navigation that reuses the hosting page, such as a query-only Back or Forward on a filtered list, leaves the dialog open with its draft.
Feature pages list each dialog's outcome kinds and each opener's reaction: a refresh, a toast through `TOAST_SERVICE` naming the record, a navigation, or opening the next dialog.
Every domain form emits `draftChange: OutputEmitterRef<DraftState>` (`dirty`, `pending`, `unconfirmed`, and a `summary` naming what would be lost, or `null`); `unconfirmed` is true after the form's last save got no response, until a reread or the next answered save settles it, so a session that ends meanwhile reports the save as unknown, not as unsaved. `FormDraft` is `interface FormDraft { draft: Signal<DraftState> }`, and every implementer declares `draft` public.
Each application form dialog implements it from the latest `DraftState`, and a routed page that hosts form dialogs implements it by delegating to its open dialog (a routed form page that also hosts form dialogs, such as the sprint plan, combines its own draft with the dialog's: dirty, pending, or unconfirmed when either is), so `UnsavedChangesGuard` (its `canDeactivate`) and session end see dialog drafts; [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) holds the detail.
There is no cross-view client cache: views read on activation and reload after their own mutations, through `reload()` or a changed query.
Every domain view that owns read resources takes `refresh: InputSignal<number>`; a change rereads its resources and keeps its drafts and pending sets.
A page binds that input to its own counter, plus the layout's `revision` on `ProjectLayoutPage` child routes, and increments the counter after any committed, not-found, or outdated dialog outcome, and at once when an open dialog relays `unconfirmed`; a `ProjectLayoutPage` child page calls the layout's `refresh()` (or `modeChanged()`) instead when the header must reread too, including on a view's `retryRequested` and first `notFound`. That is the whole invalidation map.
Domain forms hosted by an application dialog are the exception: they take no `refresh` input, because each reads its record when the dialog opens and lives only as long as the dialog.
A domain view splits when its consumers hold different state, for example `WorkHierarchyView`, `WorkListView`, `WorkItemDetailView`, and `WorkItemForm`. Presentational controls are reused; there is no universal feature component or global store.

#### Session handling

`SessionService` in `api` owns the in-memory access token, a monotonically increasing session `generation`, and the capability summary in the root `currentSession` signal. It and `ToastService`, which holds only the visible toasts and clears them on `end()`, are the only stateful adapters; neither holds protected feature data.
The capability summary is session state, not a per-consumer `ResourceRef`.
Every protected request passes through `sessionInterceptor`, an HTTP interceptor inside `api` that attaches the token and captures the generation when a resource sends its read or a mutation is sent.
A `401` carrying the current generation calls `SessionService.end(Unauthorized)` once, and that request's promise rejects with its `401`.
A `401` proves nothing was written, so login shows `session-unsaved` when that request's draft was dirty.
`SessionEndedError` is reserved for a request whose generation ended while it was in flight: its late response or error is discarded with no logout, a read resource keeps its state, and a mutation promise rejects with `SessionEndedError`.
That mutation may or may not have committed: when the form or dialog that sent it reports it pending through `FormDraft`, login shows `session-save-unknown`; a board move, reorder, status control, or other mutation without a `FormDraft` ends on `session-ended`, and its view rereads after sign-in. Later `401` responses for an ended generation no longer match and are ignored.
`end(reason)` is the single session-end path, for `SignedOut`, `Expired` (proactive expiry at the token's `exp`), and `Unauthorized`. `ApplicationShell` navigates to login on `Expired` and `Unauthorized`; a `SignedOut` caller navigates first and then calls `end(SignedOut)`.
It increments the generation, aborts in-flight protected requests inside the interceptor, clears the token and capability summary, and leads to navigation to login.
Every navigation to `/login` (Sign out, the own-password sign-out, the session-end navigation, and `AuthenticationGuard`'s redirect) and `LoginPage`'s navigation after sign-in replace the current history entry (`replaceUrl`), and `/login` opened while a session is held redirects to `/home`, except the sign-out navigation itself: a `SignedOut` caller navigates with router state `{ signOut: true }`, which the `/login` guard lets through before the caller calls `end(SignedOut)`. Browser Back therefore never reaches the sign-in form of a live session.
Unsubscribing aborts the `HttpClient` request, so cancellation stays inside `api`. Cancellation never implies that a mutation did not commit.
The navigation to login destroys route-owned components and route-scoped providers holding protected data, and their resources with them. No protected data is kept in root-level caches or browser storage.
`refreshCapabilities(): Promise<CurrentSession | null>` loads the capability summary after login and on each primary-route activation through `PermissionGuard`; with no token it resolves `null` without a request.
`sessionInterceptor` also calls it after any `403` carrying the current generation, and the `403` still reaches its caller, which presents it under the [failure presentation](#failure-presentation) rules; at most one refresh is in flight.
`sessionInterceptor` also sets an `offline` signal on the session service when a request gets no response and clears it on the next response; `ApplicationShell` shows the offline banner from it, whose Try again reloads the current route: it navigates to the shell's componentless `reload` child route with `skipLocationChange` and then back to the current URL, so leaving passes through `UnsavedChangesGuard` and the route's guards and views are created again and read again (a plain same-URL navigation would reuse them). Toasts go through `IToastService`/`TOAST_SERVICE` to a presentational `ToastRegion` hosted by `ApplicationShell`, and clear on `end()`.
[Sign in and end a session](identity/sign-in-and-end-session/README.md) holds the detailed protocol and its unsaved-input rules.

#### Capabilities and permissions

`CurrentSession.capabilities` names the profile P operations that need more than an active session: `leads.manage`, `workspaces.manage`, `workspaces.changeMode`, `work.delete`, `accounts.manage`, and `audit.read`.
An Administrator holds all six and a Collaborator none.
Reading contacts, workspaces, and work; creating and updating work; prioritizing; moving cards; and planning, starting, re-scoping, and closing sprints need only an active session.
Routed pages read `currentSession` through `SESSION_SERVICE` and pass computed boolean inputs, such as `canManageLeads`, `canManageWorkspace`, `canChangeMode`, and `canDeleteWork`, to domain views.
A domain view given `false` hides or disables the control and renders its reason text. The API enforces every permission independently and returns `403`.

#### Failure presentation

The shell's status pages show only what no routed view can: an address that matches no client route (the shell's `**` child route), a route the role cannot use (`PermissionGuard`), a `403` on a capability route's page, and a failure before any view exists.
`ApplicationShell` renders the presentational `ShellStatusView` (not found, access denied, error, or offline) in place of its outlet while the root `RouteContext.status` signal is set: `PermissionGuard` sets it before cancelling a denied navigation, routed pages call `inject(ApplicationShell).showStatus(kind, referenceId?)`, and the `**` route renders `ShellStatusView` directly. The next navigation clears it when it starts, and Try again navigates to the attempted URL with `onSameUrlNavigation: 'reload'`, so route matching and guards run again even when the router already holds that URL (a `BoardModeGuard` that declined its match leaves the router at the board URL on the `**` route). When the capability check fails and no summary is held, routes that need no capability still open and report their own read failures; capability routes get the error or offline page.
A malformed or missing record ID inside a matched route reaches the routed view, whose read gets `404` and shows that view's own not-found state.
[Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) holds the detail.

A `400` refusal shows its reason with no Retry and no reference ID, because retrying only repeats the refusal: a field-level `400` shows the field message, and a board offers Reload board instead.
Retry belongs to `500`, `503`, and a read that gets no response; the reference ID appears only when a response carried one (`500`, `503`). A mutation that gets no response is an uncertain outcome: it may have committed, so the view keeps the input, says it couldn't confirm the result ("We couldn't confirm whether …"), reads persisted state before another attempt, and never states that nothing changed.
A move refused because the board changed after it loaded shows a page alert on the board, not a toast, with Reload board.

An unexpected `403` on a change that needs only an active session (a card move; work create, update, or prioritize; or a sprint plan, start, scope change, or close) restores the caller's saved state.
Its routed page then shows the "Your access changed" toast through `TOAST_SERVICE`, without Retry, and the capability refresh still runs.
A caller with a designed `403` presentation, such as an administrator-only dialog or a capability route, shows that presentation instead.

#### Project layout

`ProjectLayoutPage` in the application project is the routed parent for `/projects/:workspaceId`, with child routes overview, work, work-list, work/:itemId, backlog, board, and sprints.
It composes the domain `ProjectHeaderView`, which injects `WORKSPACE_SERVICE` and owns the workspace resource: name, mode, responsible lead, and the tabs for that mode. When that read fails with `404` the header shows only the breadcrumb; with `500`, `503`, or no response it also shows a compact alert with Try again, whose `retryRequested` the layout maps to `refresh()`.
Every child route has `canDeactivate: UnsavedChangesGuard`, and each child page's `draft` falls back to the layout's open dialog; the layout route itself has none, so leaving a project asks once.
The pinned header and tabs render on every child route, with the Work tab active for work-list and work/:itemId. Project actions appear only with `workspaces.manage`, and a Collaborator sees a notice instead; the actions open `ProjectFormDialog`, `ProjectDeleteDialog`, and `ModeChangeDialog`.
The layout computes `canManageWorkspace`, `canChangeMode`, and `canDeleteWork` from `currentSession`; work pages read `canDeleteWork` from the layout and pass it to `WorkHierarchyView`, down to `WorkHierarchyBranch`, and to `WorkItemDetailView`.
`BoardModeGuard` (`canMatch`) matches `KanbanBoardPage` or `SprintBoardPage` by mode; a mode-changed `409` reloads the header resource and re-matches the board route, and a `sprints` route with no Sprints tab redirects to `overview`. A `404` from its mode read redirects to `overview`, which shows Project not found. When the read fails with `500`, `503`, or no response, it sets the shell's error or offline status and declines the match, so the router lands on the shell's `**` route at the board URL and the shell shows that status; Try again navigates there with `onSameUrlNavigation: 'reload'`, which matches again.
Pages outside the layout that show project data, such as sprint planning and sprint history, read the workspace themselves through `WORKSPACE_SERVICE` (`workspaceResource`); a dialog that shows a project name takes it as an input from its opener.
A missing workspace on any project page or tab shows Project not found with Back to projects.
`ProjectHeaderView` emits `workspaceLoaded`, and the layout exposes the latest resolved workspace as its `workspace` signal, which supplies `openDialog(kind)` and the project name that child pages pass to their dialogs (for example `workspaceName` for `SprintFormDialog` and `StartSprintDialog`); child pages reach the layout through `inject(ProjectLayoutPage)` to open its dialogs (paused-sprint banners relay `changeModeRequested` this way) and to register their header create action with `setTabAction({label, run})`, cleared when the page is destroyed.
[Create and manage project workspaces](projects/manage-workspaces/README.md) owns this layout, and [Change workspace delivery mode](projects/change-delivery-mode/README.md) references it.

#### Loading, rendering, and retention

The essential shell (login, layout, and navigation) loads eagerly; every feature route is lazy-loaded. No blanket preloading is configured until measurement supports it.
Components use OnPush change detection, or the chosen Angular version's default equivalent.
Every reorderable row or card renders through `@for ... track item.id` on its stable ID, so focus and row state follow the item.
Derived projections use `computed` signals, never template method calls.
Initial and lazy bundle budgets and component-style budgets are set in the production build from measured output at the Angular-version gate.
Collapsing a hierarchy branch releases its loaded descendants, and route-owned state is released on destroy.
A board column keeps its appended batches only while the board is open.
[Release measurement](operations/measure-release-performance/README.md) records retained card/node counts and the memory trend for a large workspace.
Windowing or virtualization arrives only if that measurement fails; no new business limit on workspace or sprint size is introduced.

#### Responsive layout and accessibility

Responsive profile R covers `320`, `375`, `576`, `768`, `992`, `1200`, and `1920` CSS-pixel widths at `800` pixels high.
Every production UI slice inherits L2-030–L2-035 (responsive, feedback, keyboard, label, contrast, touch, and zoom behavior) and L2-043's failure presentation, and every protected endpoint and view inherits L2-002 through `CurrentAccountAuthorization` and `sessionInterceptor`, even where a feature table does not repeat them.
Forms stack on compact screens. Below `576px`, form dialogs become full-screen sheets with a pinned footer, and confirmation dialogs stay centered with full-width stacked actions. The sheet's scroller reserves bottom scroll padding equal to its pinned footer plus any visible toast region, and pinned page headers reserve top padding, so a focused control is never under fixed content (L2-033.3).
Each component keeps its template, styles, and class in separate files.
Component styles read `var(--mc-<role>)` tokens and change layout only through named breakpoints such as `@include mc-bp.up(md)`.
Both come from the design system's [deterministic mirror](artifacts/review-design-language/README.md); a hard-coded color, dimension, or font stack is a defect, and a missing token is added to the design system first.
Keyboard operation includes visible focus, named controls, modal focus containment, trigger focus restoration, and destination-heading focus after navigation.
Inputs have associated labels and field errors identify their inputs.
Asynchronous outcomes are announced through status or alert regions without moving focus, unless the outcome disables or removes the control that has focus: focus then moves to the outcome's alert (`tabindex="-1"`) or to its first offered action.
A server `400` with one field error moves focus to that field, which reads its error; with several field errors, focus moves to the error summary, which links to each field. Neither offers Retry or a reference ID ([failure presentation](#failure-presentation)).
A dialog shows its blocked, stale, conflict, not-found, or forbidden explanation inside its own alert region, and the dialog's `aria-describedby` then points to that explanation; an `aria-describedby` never points at text hidden in the current state.
`ApplicationShell` renders `ToastRegion` in the overlay layer, stacked above any open dialog and outside the background a modal makes inert, so both live containers keep announcing while a dialog is open; below `576px` the region sits above a sheet's pinned footer, so no toast covers the footer's actions, and the sheet's bottom scroll padding includes the toast region, so a focused field never sits under a toast. A toast's own actions become reachable once the dialog closes.
Status text supplements color; primary touch targets measure at least `44×44` CSS pixels.
The mocks provide static state and interaction evidence; backend constraints and API errors remain authoritative.

#### Incremental ATDD

Production implementation proceeds one behavior at a time: linked Given-When-Then criteria, an acceptance check run red for the expected missing behavior, the minimal implementation, then green regression checks before the next behavior.
Backend acceptance checks are API integration tests in `backend/tests`. Frontend checks run Playwright in Chromium only, against the `e2e` mock composition, with one page object per screen; tests state intent and page objects own selectors.
Each API integration and Playwright acceptance test file begins with a comment listing the L2 IDs and criteria it covers. The comment is documentation only; nothing parses it.
Mocks, the design system, and this documentation are design artifacts: no ATDD and no tests. No architecture, structure, naming, or specification-traceability tests are written.

### Retained decisions and gaps

| Retained decision | Design status |
| --- | --- |
| Roles, lead cardinality/validation, Scrum rules, in-memory 30-minute sessions, WCAG target, performance profile | Proposed L2 baseline; this design does not promote these defaults to confirmed product decisions. |
| SQL provider and versions of .NET, Angular, SQL, and tooling | `<TO SUPPLY>` before dependent implementation. |
| Hosting topology, production HTTPS, configured CORS origins, signing algorithm/key source, secret-management facility | `<TO SUPPLY>` before authentication/deployment implementation. |
| Hash adapter algorithm parameters, provider-specific migration/order/transaction locking, isolation level, and lock timeout | `<TO SUPPLY>` before security/persistence implementation. |
| Backup commands, storage access, schedule, retention, responsible operator, restore commands, and latest rehearsal | `<TO SUPPLY>` in `docs/operations/recovery-runbook.md` before release. |
| Release measurement composition | L2-046.2 cold-view runs use the production HTTP composition against the isolated fixture, kept separate from `e2e/specs`; all acceptance specs keep the mock composition. "Cold frontend cache" is interpreted as authenticated navigation with the HTTP cache cleared, a proposed interpretation recorded in every result. |
| Design-system build/hosting commands and maintainer | `<TO SUPPLY>` before independent artifact delivery. |
| Project-local display keys such as `HCK-112` | Mock representation; allocation policy `<TO SUPPLY>`, separate from stable required IDs. |
| City seed completion marker, all-account email immutability, preserved Kanban Sprints tab, designated-administrator name lock (L2-008 protects email, status, and role; L2-006 is met by the seed's repair), every existing sprint (planned, active, or closed) blocking workspace deletion, the 200-character limit on assignee search text (L2 sets none), the 25-planned-sprint bound on sprint-closure destinations (L2-025 allows any eligible planned sprint) | Explicit design proposals explained in the relevant feature pages; no silent specification amendment. |

Framework/provider choices remain explicit gaps because the inputs do not establish them. No release-recovery or measured-performance result is claimed.
Deferred PRD capabilities, including messaging, public registration, external identity, and multi-city tenancy, remain outside this design.

## Requirements

Every L2 appears below with its defining feature; cross-cutting requirements also occur in the feature pages where they apply, apart from the inherited L2-002, L2-030–L2-035, and L2-043 described under [Responsive layout and accessibility](#responsive-layout-and-accessibility).

| L2 | Refines | Feature designs |
| --- | --- | --- |
| `L2-001` — Credential login | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md) |
| `L2-002` — JWT validation and current access | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md) |
| `L2-003` — Session expiry and logout | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Provision and manage accounts](identity/manage-accounts/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-004` — Administrative account management | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Provision and manage accounts](identity/manage-accounts/README.md) |
| `L2-005` — Permission enforcement and contact/account separation | `L1-001` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Provision and manage accounts](identity/manage-accounts/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Find and read lead contacts](leads/find-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Review home coverage and progress](workspace/review-home/README.md) |
| `L2-006` — Initial administrator bootstrap | `L1-002` | [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-007` — Repeatable and repairing administrator seed | `L1-002` | [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-008` — Protect the designated administrator | `L1-002` | [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-009` — Create and validate lead contacts | `L1-003` | [Create and edit lead contacts](leads/maintain-contacts/README.md) |
| `L2-010` — Lead directory, details, search, and filtering | `L1-003` | [Find and read lead contacts](leads/find-contacts/README.md) |
| `L2-011` — Edit lead contacts | `L1-003` | [Create and edit lead contacts](leads/maintain-contacts/README.md) |
| `L2-012` — Delete leads without unrelated data loss | `L1-003` | [Delete an unreferenced lead contact](leads/delete-contact/README.md) |
| `L2-013` — Identify the City Lead | `L1-003` | [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Find and read lead contacts](leads/find-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md) |
| `L2-014` — Project workspace management | `L1-004` | [Create and manage project workspaces](projects/manage-workspaces/README.md) |
| `L2-015` — Create and navigate the work hierarchy | `L1-004` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md) |
| `L2-016` — Edit, assign, and reparent work | `L1-004` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md) |
| `L2-017` — Stable prioritization and backlog ordering | `L1-004` | [Prioritize siblings and the story backlog](work/prioritize-work/README.md) |
| `L2-018` — Safe work-item deletion | `L1-004` | [Delete permitted leaf work](work/delete-leaf-work/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md) |
| `L2-019` — Kanban board and story details | `L1-005` | [View the Kanban story board](kanban/view-story-board/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-020` — Persisted and accessible Kanban moves | `L1-005` | [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-021` — Explicit story completion with unfinished tasks | `L1-005` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-022` — Plan sprints and allocate stories | `L1-006` | [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md) |
| `L2-023` — Start and manage the active sprint | `L1-006` | [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md) |
| `L2-024` — Execute work on the sprint board | `L1-006` | [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md) |
| `L2-025` — Close sprints and resolve unfinished work | `L1-006` | [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md) |
| `L2-026` — Preserve and display sprint history | `L1-006` | [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-027` — Change delivery mode safely | `L1-006` | [Change workspace delivery mode](projects/change-delivery-mode/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md) |
| `L2-028` — Accurate home summaries | `L1-007` | [Review home coverage and progress](workspace/review-home/README.md) |
| `L2-029` — Contextual navigation and direct routes | `L1-007` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Find and read lead contacts](leads/find-contacts/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md), [Provision and manage accounts](identity/manage-accounts/README.md), [Review security and mutation audit events](identity/review-audit-events/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md) |
| `L2-030` — Responsive application workflows | `L1-008` | [Find and read lead contacts](leads/find-contacts/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-031` — Reliable form submission and destructive confirmations | `L1-008` | [Provision and manage accounts](identity/manage-accounts/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-032` — Empty, loading, error, and visual feedback states | `L1-008` | [Find and read lead contacts](leads/find-contacts/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md), [Review the standalone design language](artifacts/review-design-language/README.md) |
| `L2-033` — Keyboard operation and focus management | `L1-009` | [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-034` — Accessible labels, structure, and announcements | `L1-009` | [Find and read lead contacts](leads/find-contacts/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-035` — Contrast, zoom, touch, and non-color meaning | `L1-009` | [View the Kanban story board](kanban/view-story-board/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md), [Review the standalone design language](artifacts/review-design-language/README.md) |
| `L2-036` — Credential, token, and secret protection | `L1-010` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-037` — Safe input handling and API boundaries | `L1-010` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Find and read lead contacts](leads/find-contacts/README.md) |
| `L2-038` — Authentication abuse throttling | `L1-010` | [Sign in and end a session](identity/sign-in-and-end-session/README.md) |
| `L2-039` — Audit security and data mutations | `L1-010` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Review security and mutation audit events](identity/review-audit-events/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Change workspace delivery mode](projects/change-delivery-mode/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md) |
| `L2-040` — Durable, atomic business changes | `L1-011` | [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Change workspace delivery mode](projects/change-delivery-mode/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md), [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-041` — Conflict detection and relational constraints | `L1-011` | [Provision and manage accounts](identity/manage-accounts/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Create and edit lead contacts](leads/maintain-contacts/README.md), [Delete an unreferenced lead contact](leads/delete-contact/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Change workspace delivery mode](projects/change-delivery-mode/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [Delete permitted leaf work](work/delete-leaf-work/README.md), [Move and reorder story cards](kanban/move-story-cards/README.md), [Confirm story completion with unfinished tasks](kanban/confirm-story-completion/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Start a sprint and change its active scope](scrum/start-and-adjust-sprint/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md) |
| `L2-042` — Repeatable initialization and health status | `L1-012` | [Initialize and protect the administrator](identity/initialize-administrator/README.md) |
| `L2-043` — Diagnosable errors and request correlation | `L1-012` | [Sign in and end a session](identity/sign-in-and-end-session/README.md), [Initialize and protect the administrator](identity/initialize-administrator/README.md), [Review security and mutation audit events](identity/review-audit-events/README.md), [Navigate with context and preserve form input](workspace/navigate-and-recover-input/README.md) |
| `L2-044` — Backup and restore readiness | `L1-012` | [Rehearse backup and restore](operations/restore-data/README.md) |
| `L2-045` — Bounded collection loading | `L1-013` | [Provision and manage accounts](identity/manage-accounts/README.md), [Review security and mutation audit events](identity/review-audit-events/README.md), [Find and read lead contacts](leads/find-contacts/README.md), [Create and manage project workspaces](projects/manage-workspaces/README.md), [Create and navigate the work hierarchy](work/create-and-navigate-work/README.md), [Edit, assign, and reparent work](work/edit-and-reparent-work/README.md), [Prioritize siblings and the story backlog](work/prioritize-work/README.md), [View the Kanban story board](kanban/view-story-board/README.md), [Plan sprints and allocate stories](scrum/plan-sprints/README.md), [Execute work on the active sprint board](scrum/execute-sprint-work/README.md), [Close a sprint and resolve unfinished work](scrum/close-sprint/README.md), [Read immutable sprint history](scrum/read-sprint-history/README.md), [Review home coverage and progress](workspace/review-home/README.md), [Measure release workflow performance](operations/measure-release-performance/README.md) |
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
