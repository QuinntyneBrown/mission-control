# Detailed design audit: quality, maintainability, and performance

**Date:** 2026-10-01

**Scope:** Current working-tree designs, with emphasis on the Angular frontend.

**Result:** The architecture is a sound starting point, but the affected production slices need the five P1 findings resolved before implementation. Frontend state ownership, collection rendering, and performance measurement need more precise decisions.

## Scope and method

The review covered the design overview and all 27 feature README files under [detailed-designs](detailed-designs/README.md), compared with [AGENTS.md](../AGENTS.md), the [PRD](PRD.md), and the [L1](specs/L1.md)/[L2](specs/L2.md) baseline. Targeted PlantUML source review examined service contracts, state ownership, persistence relationships, and mutation/error sequences. Two representative rendered diagrams were visually inspected: the board-move component view and the home class view.

The repository currently contains design documents and static mocks, rather than a production Angular/.NET application. Findings concern documented contradictions, missing decisions, and inferred implementation risks. No runtime defect, latency, bundle size, or memory consumption was measured. An omitted decision is not evidence that the future implementation will necessarily be wrong.

Documentation inventory: 28 Markdown files including the overview, 159 PlantUML sources, and 159 PNGs. Every PlantUML source has a PNG sibling, and every local Markdown link in the design tree has an existing file target. Fragment/state destinations were not exhaustively verified. This does not establish that every PNG matches its latest source; diagrams were not regenerated in this audit.

Existing working-tree edits were treated as review inputs. This audit adds this report only. No application, design, requirement, mock, or test changes were made.

| Subsystem | Feature designs reviewed | Review emphasis |
| --- | ---: | --- |
| Identity | 4 | Authentication, session lifecycle, account access, bootstrap, audit |
| Leads | 3 | Directory requests, contact validation, ownership blockers |
| Projects | 2 | Workspace forms, counts, mode transitions, deletion |
| Work | 4 | Hierarchy paging, assignments, reparenting, three independent orders |
| Kanban | 3 | Card loading, optimistic moves, completion confirmation |
| Scrum | 5 | Paged selection, active scope, closure, immutable history |
| Workspace | 2 | Guards, dirty forms, summaries, state invalidation |
| Operations | 2 | Measurement validity, load realism, restore safeguards |
| Artifacts | 2 | Independent design system, token ownership, mock boundaries |

## What is already strong

- The overview defines Clean Architecture, thin MediatR controllers, the `12.5.0` pin, interface/token consumption, and clear frontend library responsibilities. These decisions should remain intact.
- Collection endpoints generally have bounded loading, full counts, and stable ordering. Hierarchy expansion is lazy, and home sections can recover independently.
- Concurrency is treated as a product behavior: versioned writes, transactional ordering, shared completion checks, and SQL constraints supplement application validation.
- Board status, backlog priority, and sibling ordering are explicitly independent. Closed sprint facts survive subsequent live edits and deletion.
- Frontend designs cover keyboard alternatives to dragging, focus restoration, responsive layouts, linked validation, and preserving drafts after failures.
- Security and recovery decisions are explicit: in-memory tokens, current SQL authorization, password-version invalidation, transactional success audit, preserved administrator passwords, and isolated restores.
- The documents distinguish proposed defaults from approved decisions and distinguish performance targets from measured results. Provider, framework, deployment, and security gaps are visibly retained.

## Priority summary

P1 means resolve before implementing the affected behavior: the missing decision can prevent a required workflow, lose user intent, expose stale session data, or invalidate release evidence. P2 means resolve in the relevant design slice and verify before release. P3 is documentation/process maintenance. No P0 emergency is identified in this design-only repository.

| ID | Priority | Finding | Evidence type |
| --- | --- | --- | --- |
| A01 | P1 | Collaborator assignment has no permitted assignee lookup | Contract gap |
| A02 | P1 | Full-replacement sprint plans lack selection semantics across pages | Contract gap and contradictory eligibility wording |
| A03 | P1 | Optimistic board snapshots lack overlapping-operation rules | Inferred correctness risk |
| A04 | P1 | Session cleanup is promised without a protocol across all adapters and views | Ownership/lifecycle gap |
| A05 | P2 | Feature state and invalidation have multiple possible owners | Maintainability gap |
| A06 | P2 | Bounded requests do not bound retained cards or hierarchy nodes | Frontend performance gap |
| A07 | P2 | Related collections escape the documented paging model | Response/review-flow gap |
| A08 | P2 | Route loading and rendering policy are unspecified | Frontend performance gap |
| A09 | P1 | The load runner can pass without successful permitted operations | Measurement contradiction |
| A10 | P2 | Response-start timing is labeled as full server operation time | Measurement boundary gap |
| A11 | P2 | The cold-view clock excludes initial frontend bootstrap | Measurement boundary gap |
| A12 | P2 | Closure conflicts promise change attribution that scope history cannot provide | Model/behavior contradiction |
| A13 | P2 | A read transaction alone does not guarantee consistent summary counts | Persistence correctness gap |
| A14 | P2 | Query shape and workspace-lock cost need concrete measurement cases | Backend/frontend performance gap |
| A15 | P2 | Shared diagrams contain conflicting responsibility cues | Design maintainability issue |
| A16 | P3 | Repeated policies and manual token mirroring invite drift | Documentation/process risk |

## Findings and feedback

### A01 — Define an assignee lookup available to collaborators

**Evidence:** [Work editing](detailed-designs/work/edit-and-reparent-work/README.md#description) permits active-user assignment and retains existing inactive assignees. [Account management](detailed-designs/identity/manage-accounts/README.md#description) exposes `/api/accounts[/{id}]` through the administrator-only account workflow. [Navigation](detailed-designs/workspace/navigate-and-recover-input/README.md#description) makes `/accounts` administrator-only. No assignee-choice endpoint or service method is specified in the work designs.

**Impact:** A collaborator can submit a known user ID but has no designed way to discover eligible users. Reusing the administrator directory could either deny the required workflow or unnecessarily broaden account-data access.

**Feedback:** Add a bounded, searchable assignee-choice query to the work slice, with a minimal ID/display-name projection and an explicitly permitted authenticated read policy. Consume it through a contract/token in `api`; keep administrative account operations restricted. Include the currently selected inactive user in edit detail data without offering that user as a new assignment. Specify loading, no matches, failed lookup, and deactivation-after-selection behavior.

**Verification:** Given a collaborator creating or editing work, when they search for an active person and assign them, then the assignment saves without access to administrative account endpoints. Given a selected person becomes inactive, when saving, then the assignee field error preserves the remaining draft. API integration checks prove permissions; Chromium page-object flows use the required mock composition. Relevant baseline: L2-005, L2-016, L2-045.

### A02 — Make paged sprint selection safe for full-replacement saves

**Evidence:** [Sprint planning](detailed-designs/scrum/plan-sprints/README.md#description) pages story pickers and atomically replaces membership. Its [class diagram](detailed-designs/scrum/plan-sprints/diagrams/class-structure.puml) sends the complete `storyIds` array in `SaveSprintPlanCommand`, while `GetSprintPlanQuery` has one `page`/`pageSize` pair. The prose both rejects Done selections and permits retaining already-selected stories that became Done.

**Impact:** Saving only the loaded selected page could remove untouched membership. Selection may disappear on filtering or pagination. Without distinguishing retained membership from newly added stories, saving unrelated plan fields can reject a valid existing Done member.

**Feedback:** Specify one selection model before implementing the picker. A simple option is a versioned add/remove delta applied atomically against saved membership, while available and selected lists page independently. If retaining full replacement, specify how the complete selected-ID set is obtained and maintained independently of rendered pages. Define existing-membership versus new-allocation validation explicitly, preserve choices across searches, and keep stale-plan conflicts as explicit review rather than automatic resubmission.

**Verification:** Given more than 100 selected stories, when a user changes one selection on a later page and saves, then every untouched membership remains. Given an existing member becomes Done, when unrelated plan fields are saved, then that member is retained; a new Done allocation is rejected. Relevant baseline: L2-022, L2-031, L2-041, L2-045.

### A03 — Define serialization and reconciliation for optimistic board moves

**Evidence:** [Board moves](detailed-designs/kanban/move-story-cards/README.md#description) snapshot the saved board, optimistically move a card, and restore the snapshot on failure. The [move sequence](detailed-designs/kanban/move-story-cards/diagrams/sequence-move.puml) returns a committed placement and versions but directs the page to replace its snapshot with the committed board. Ordering can shift rows outside the loaded batch, and the documents do not define overlapping moves or reads during a pending move.

**Impact:** Move A can commit, then failed move B can restore a snapshot from before A. A late batch read can overwrite the optimistic state. Applying only the returned card position does not necessarily reconcile all shifted positions, totals, or page boundaries.

**Feedback:** Use the simplest initial rule: allow one pending placement mutation per board, suppress further move actions until it resolves, and associate every read/result with the board identity and request generation. Define whether success patches a complete affected interval or refetches affected bounded columns. After an uncertain result, reconcile persisted state before another explicit move. Keep the unfinished-task confirmation distinct from stale-version recovery. The rollback target must be the latest acknowledged saved state.

**Verification:** Given a delayed move, when another move or Load more is attempted and responses finish out of order, then saved ordering is not replaced by an older snapshot. Given a cross-page move commits, when affected columns are read, then the story appears once with correct counts and positions. Relevant baseline: L2-020, L2-024, L2-041.

### A04 — Define session cleanup across adapters, caches, and late errors

**Evidence:** [Sign-in/session design](detailed-designs/identity/sign-in-and-end-session/README.md#description) assigns protected-cache cleanup, cancellation, and a session generation counter to `SessionService`. Other HTTP requests belong to separate adapters and view signals. [Navigation](detailed-designs/workspace/navigate-and-recover-input/README.md#description) says a `401` from any request clears the session and a `403` discards the capability summary, but it does not describe how those adapters participate in the protocol.

**Impact:** A response from session A could populate a view after session B signs in. A late `401` from A could log out B. Clearing the token alone cannot clear signals owned by mounted components or other services. Capability caching also needs a freshness policy: relying only on `403` can leave controls stale after role promotion or successful read-only requests.

**Feedback:** Define a small shared protocol within `api`, reached through interfaces/tokens. Every protected adapter captures a session generation when sending; success and failure handlers may affect current state only if that generation still matches. Specify how cancellation and view/cache invalidation are registered and released. Define proactive expiry handling and capability refresh/deduplication. Keep unsaved-draft behavior aligned with L2-003 and avoid persisting tokens or protected drafts in browser storage. Cancellation must never be treated as proof that a server mutation did not commit.

Angular documents that unsubscribing aborts an in-progress `HttpClient` request; the cancellation mechanism therefore belongs inside the HTTP adapter rather than requiring domain components to manage HTTP subscriptions. [Angular HTTP requests](https://angular.dev/guide/http/making-requests)

**Verification:** Given a slow protected read and error from A, when A logs out and B signs in before either finishes, then neither A's data nor its `401` affects B. Given expiry while several requests are active, when it is handled, then protected content clears and login opens once. Relevant baseline: L2-002, L2-003, L2-005, L2-036.

### A05 — Assign one owner to feature data, drafts, and invalidation

**Evidence:** The [overview](detailed-designs/README.md#description) assigns observable-to-signal conversion to HTTP adapters and feature state to domain components. [Home](detailed-designs/workspace/review-home/README.md#description) gives each view its own state and promises mutation-driven summary invalidation. [Work diagrams](detailed-designs/work/create-and-navigate-work/diagrams/class-structure.puml) compose one `WorkItemView` from hierarchy, list, detail, and form consumers, without describing independent request/state instances or action outputs.

**Impact:** A shared mutable service result could let opening a detail or picker overwrite another consumer's list. Alternatively, duplicating state in adapter, view, and page creates synchronization work. An application page could end up reaching through component internals to drive dialogs or invalidate summaries.

**Feedback:** Document the contract return model, provider scope, and data owner for each concurrent consumer. Promise-based results can feed view-owned signals while RxJS stays inside adapters; adapter-owned signal resources are also possible if explicitly scoped per consumer. Choose one pattern. Keep drafts in the owning form, define domain inputs/outputs for application-owned dialogs, and define a minimal mutation-to-invalidation map. Split hierarchy/list/detail rendering components when their state and behavior differ; reuse presentational controls without building a universal feature component or global store.

**Verification:** Given a list, detail, and picker are active, when one loads or fails, then the other consumers retain their own results. Given a committed task change, when the relevant board or home summary is revisited, then it refetches the correct data. Review ownership through design and compiler checks; do not introduce architecture tests. Relevant baseline: L2-024, L2-028, L2-031, L2-032.

### A06 — Bound retained/rendered collections as well as network batches

**Evidence:** [Hierarchy loading](detailed-designs/work/create-and-navigate-work/README.md#description) appends batches on expansion. [Kanban loading](detailed-designs/kanban/view-story-board/README.md#description) provides Load more per column and retains loaded cards. The 100-item request ceiling does not limit the cumulative number of mounted nodes or retained snapshots.

**Impact:** Repeated Load more, expansion, and navigation can eventually mount thousands of rows. Whole-board optimistic snapshots multiply the retained data. A bounded initial response alone does not protect rendering, memory, keyboard responsiveness, or long sessions.

**Feedback:** Specify a rendered-window and retention policy. Prefer ordinary paging where practical; for boards/hierarchies choose bounded windows or measured virtualization only where needed. Remove collapsed descendant views, release route-owned resources on destruction, and keep counts independent of rendered rows. Preserve focused controls when windows change, and keep every item reachable through accessible paging/move controls. Do not impose a new business limit on workspace or sprint size to solve a rendering problem.

**Verification:** In release performance tooling, exercise repeated Load more, branch expand/collapse, and route changes against a deliberately large workspace. Record retained card/node counts, memory trend, and interaction traces after initial load. Behavioral Chromium checks prove that unloaded/windowed items remain reachable and focus remains usable. Relevant baseline: L2-030, L2-033, L2-045, L2-046.

### A07 — Page related collections and define the closure review source

**Evidence:** [Lead detail](detailed-designs/leads/find-contacts/README.md#description) returns `responsibleWorkspaces`; [lead deletion](detailed-designs/leads/delete-contact/README.md#description) lists blocking workspaces in ProblemDetails. [Workspace deletion](detailed-designs/projects/manage-workspaces/README.md#description) names all sprints. [Sprint history](detailed-designs/scrum/read-sprint-history/README.md#description) pages outcomes but does not explicitly page scope history. [Closure](detailed-designs/scrum/close-sprint/README.md#description) lists every unfinished story, without a documented review query independent of the bounded board.

**Impact:** A detail/error response can become the unbounded collection endpoint that the main lists avoided. Building closure choices from currently loaded board cards can omit unfinished stories; loading all cards solely to open the dialog defeats bounded loading. Long scope logs can grow independently of the initial fixture size.

**Feedback:** Keep detail and conflict responses small: counts, a bounded preview, and a link/query for the full related set. Specify paged scope history and an authoritative closure-review projection containing unfinished stories, valid destination choices, total counts, and the reviewed revision. Preserve disposition drafts across pages and allow final atomic closure only when every current unfinished story has a disposition. Separate persisted snapshot structure from the shape of its paged read DTOs.

**Verification:** Given related records exceed one batch, when detail, blockers, history, or closure are opened, then every record is reachable without an unbounded initial response. Given an unfinished story is on an unloaded board page, when closure is reviewed, then it still receives a disposition. Relevant baseline: L2-012, L2-025, L2-026, L2-045.

### A08 — Specify route loading, row identity, and rendering policy

**Evidence:** [Navigation](detailed-designs/workspace/navigate-and-recover-input/README.md) and the [overview](detailed-designs/README.md) define routes and signals but do not define lazy route boundaries, preload behavior, change-detection policy, stable row tracking, or production bundle budgets.

**Impact:** Login/home could download account, audit, planning, and history code before those routes are needed. Large lists can rerender more than necessary, and index-based tracking can attach focus or row-local state to the wrong work item after reorder. Signals alone do not specify these policies.

**Feedback:** Once the Angular version is selected, document a small loading policy: eagerly load the essential shell, lazy-load feature routes, and avoid blanket preloading until measurement supports it. Select OnPush behavior appropriate to the chosen version, update signal collections consistently, and track reorderable rows/cards by stable IDs. Derive expensive view projections outside repeated template calls. Add reviewed initial/lazy bundle and component-style budgets to the production build; numeric thresholds should follow measured output rather than becoming invented product requirements.

Angular provides [lazy route loading](https://angular.dev/best-practices/performance/lazy-loaded-routes), [subtree skipping with OnPush](https://angular.dev/best-practices/skipping-subtrees), [stable collection tracking](https://angular.dev/guide/templates/control-flow), and [CLI size budgets](https://angular.dev/tools/cli/build). Current documentation describes OnPush as the default from Angular v22; the repository has not chosen an Angular version, so explicitly adding it depends on that choice.

**Verification:** Review production bundle output and network traces for login, home, and an administrator route. Use the Chromium page-object workflow to reorder focused rows and retain the intended item/control. Profile a large board before introducing additional rendering machinery. Relevant baseline: L2-033, L2-045, L2-046.

### A09 — Require successful work before the load run can pass

**Evidence:** [Release measurement](detailed-designs/operations/measure-release-performance/README.md#description) records 4xx counts but passes on p95 ≤500 ms, no unexpected 5xx, and no invariant failure. It says each session writes only its allocated records so expected conflicts cannot mask results. However, [board ordering](detailed-designs/kanban/move-story-cards/README.md#description) versions an entire board: different stories can still conflict if sessions share that board.

**Impact:** Fast `400`/`401`/`403`/`409` responses can satisfy the stated latency gate while very few permitted writes commit. Data invariants can remain valid simply because nothing changed. Separate story ownership does not eliminate shared board/order/sprint version contention.

**Feedback:** Define expected statuses per operation and treat unexpected 4xx as failed workload execution. Report successful-operation p95 separately from rejected-operation latency, with enough successful samples per class to establish the workload ran. Record offered versus completed request rates, mutation outcomes, and delays rather than silently reducing load when requests slow down. Allocate independent boards/order sets for the prescribed uncontended baseline, refresh versions deliberately, and run a separately labeled shared-workspace contention scenario to assess the workspace lock. Do not blindly retry mutations to manufacture success.

**Verification:** Given all writes are deliberately rejected, when the runner completes quickly with valid stored invariants, then it fails. Given distinct cards share one board version, when moves race, then conflicts are visible separately and cannot improve successful-write p95. Relevant baseline: L2-040, L2-041, L2-046.

### A10 — Define what the API server-time measurement includes

**Evidence:** [Release measurement](detailed-designs/operations/measure-release-performance/README.md#description) defines `ServerTimingMiddleware` as pipeline entry to response start, then uses that duration as the operation's server time.

**Impact:** This boundary does not necessarily include all serialization/response work, especially when a response streams after headers start. Results could pass the 500 ms gate while substantial server work remains. The duration is useful, but its meaning is narrower than a completed operation unless the response path is proven otherwise.

**Feedback:** Define the accepted measurement boundary explicitly. Retain time-to-response-start as a diagnostic metric and collect a correlated server duration through response completion for full request processing, with a clear treatment of body transmission/backpressure. If L2-046 intentionally uses time-to-headers, record that interpretation in the requirement/measurement definition. Document clock, percentile algorithm, sample counts, and how errors are counted. Keep detailed timing enabled only in the isolated measurement environment as already proposed.

**Verification:** Given a response whose body production is delayed after headers, when measured, then the result distinguishes header latency from complete server processing and cannot silently substitute one for the other. Relevant baseline: L2-043, L2-046.

### A11 — Separate cold bootstrap, authenticated navigation, and login timing

**Evidence:** [Cold-view measurement](detailed-designs/operations/measure-release-performance/README.md#description) opens a protected direct route in a fresh context, loads sign-in, and starts timing at sign-in submission. This excludes the already-loaded shell/shared code and includes login/session-check latency.

**Impact:** A bloated initial bundle can download before the timer starts and still produce a passing result. Conversely, a slow login can dominate a view metric. The result is a sign-in-to-view measurement, which is not a complete cold frontend startup measurement. The readiness condition is also described only as the page object reporting essential content/controls usable.

**Feedback:** Record distinct intervals: first document navigation to shell readiness, sign-in submission to successful authentication, and authenticated target navigation to usable view. For a cold authenticated-view measurement, establish the session through the permitted login flow, then clear the HTTP cache without reloading or losing the in-memory session, and document the remaining warm shell state. Also report the complete fresh-context direct-route-to-view journey. Align which interval gates L2-046 with its agreed interpretation. Define readiness per screen using visible real fixture content and enabled essential actions, rather than a skeleton, spinner disappearance, or network idleness alone.

**Verification:** Given a deliberately large shell bundle, when fresh-context navigation is measured, then its download/parse cost appears in the startup/journey metric. Given skeletons render before data, when readiness is evaluated, then they do not count as a usable view. Keep 30 runs per view, record all failures, and retain exact hardware/network/cache profiles. Relevant baseline: L2-046.

### A12 — Resolve closure conflict attribution and revision semantics

**Evidence:** [Closure](detailed-designs/scrum/close-sprint/README.md#description) increments the active sprint revision for membership and relevant story/task mutations, then promises each changed story with its recorded scope change, actor, and instant on stale closure. [Scope changes](detailed-designs/scrum/start-and-adjust-sprint/README.md#description) record Add/Remove events. The [closure model](detailed-designs/scrum/close-sprint/diagrams/class-structure.puml) provides those scope events, not a per-story record of every task/status edit since the review revision.

**Impact:** A task completion or story edit can invalidate closure without creating any scope-change event. The server cannot reliably produce the promised attribution from that model. Comparing only the expected sprint revision also does not identify every changed story since review.

**Feedback:** Prefer a neutral stale-review message with a refreshed paged closure projection and preserved choices where still valid. If identifying exact changed rows is required, define reviewed row versions and comparison semantics. If edit attribution is a confirmed requirement, introduce an explicit persisted event model rather than presenting scope Add/Remove history as task-edit history. Consolidate the revision matrix: specify which story/task edits, reparentings, and moves increment the source and destination sprint revisions. Align the conflict mock with the chosen behavior.

**Verification:** Given a task changes after closure review without any membership change, when closure is submitted, then it returns a truthful conflict and offers refreshed review without fabricated actor/time attribution. Given a task moves between stories in different active sprints, then the affected reviews are invalidated consistently. Relevant baseline: L2-025, L2-039, L2-041.

### A13 — Select isolation that actually protects summary consistency

**Evidence:** [Home summaries](detailed-designs/workspace/review-home/README.md#description) claim one SQL read transaction per response avoids contradictory counts. The SQL provider and transaction implementation remain undecided in the [overview](detailed-designs/README.md#description).

**Impact:** A default read transaction does not necessarily give multiple queries the same database snapshot. For example, PostgreSQL Read Committed reads use statement snapshots; SQL Server distinguishes statement-consistent row-versioned Read Committed from transaction-consistent Snapshot. Separate count and data statements can observe different committed states. [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [SQL Server isolation](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql?view=sql-server-ver17)

**Feedback:** At the provider decision, use one projection statement where simple, or an explicitly configured transaction snapshot where multiple statements must agree. Specify the intended consistency of page rows versus totals. Preserve the existing decision that different home sections may represent different request instants; no global cross-section snapshot is needed. Avoid raising all application transactions to Serializable without a demonstrated requirement.

**Verification:** Given counts and rows are read while a mutation commits between statements, when the projection returns, then fields claimed to share one snapshot agree. Run against the selected SQL provider. Relevant baseline: L2-028, L2-040, L2-045.

### A14 — Make query and lock performance cases concrete

**Evidence:** [Lead search](detailed-designs/leads/find-contacts/README.md#description) uses case-insensitive substring matching across several fields, including combined names, with category totals. [Boards](detailed-designs/kanban/view-story-board/README.md#description) aggregate task counts; [history](detailed-designs/scrum/read-sprint-history/README.md#description) optionally resolves live titles. [Ordering](detailed-designs/work/prioritize-work/README.md#description) rewrites an affected position interval. The overview serializes workspace mutations, and the performance fixture does not define workspace-size skew or contention distribution.

**Impact:** Ordinary indexes alone do not establish that substring queries are fast. Per-card task or per-outcome live lookups could produce N+1 queries. A large reorder/closure can hold the workspace lock and delay unrelated task edits in that workspace. Uniformly distributing 10,000 items over 50 workspaces can conceal the largest operational case.

**Feedback:** Specify bounded summary DTOs that omit long descriptions from list/card responses, set-based task aggregation, batched live-history lookups, and provider-specific query-plan review. Measure literal substring search before selecting any specialized search index; preserve required substring semantics. Document lock acquisition order, timeout/error mapping, cancellation behavior, and the provider-safe update strategy for unique positions and synchronized placement status. Keep the simple workspace lock until evidence justifies changing it. Measure both the prescribed fixture and a separately reported large/hot-workspace scenario, including a long-distance reorder and closure.

For free-text directory and picker searches, specify a modest input debounce, cancellation of superseded reads inside the adapter, and a request key scoped to that consumer's search/filter/page state. Ignoring old responses, as already designed for the directory, protects display correctness but still allows avoidable requests to consume server capacity. Explicit filter/page actions should remain immediate. Measure the request count for a realistic typing burst; do not apply automatic retry or debouncing to mutations.

**Verification:** Record query counts/plans, payload bytes, lock wait versus execution time, and latency per operation class. Check card counts and history text while avoiding per-row queries. API integration tests prove atomicity and race outcomes; release tooling measures cost. Relevant baseline: L2-010, L2-019, L2-026, L2-040, L2-045, L2-046.

### A15 — Reconcile shared model and diagram responsibility cues

**Evidence:** The [session prose](detailed-designs/identity/sign-in-and-end-session/README.md#description) uses Application ports `IPasswordHashService` and `IAccessTokenIssuer`, while its [class view](detailed-designs/identity/sign-in-and-end-session/diagrams/class-structure.puml) places `verifyPassword` on `UserAccount` and shows `LoginCommandHandler` using `JwtOptions` to issue tokens. The [work class views](detailed-designs/work/create-and-navigate-work/diagrams/class-structure.puml) repeatedly show an untyped `query(specification)` and `commit(expectedVersion)` port, although writes compare several independent versions and require explicit workspace locking. The [board-move component source](detailed-designs/kanban/move-story-cards/diagrams/c4-component.puml) includes the reused label “login remains public” in a feature with no login operation.

**Impact:** Readers can implement different dependency boundaries from equally prominent sources. A generic data-session sketch does not explain transaction ownership, multiple version comparisons, lock lifetime, or cancellation. Boilerplate labels dilute the reliability of feature diagrams. The overview's explicit statement that `FeatureResult` is schematic is useful and should be preserved; this finding does not call for a universal production result type.

**Feedback:** Choose one authoritative definition for each shared contract/policy and link feature-specific scoped views to it. Show hashing/token issuance through the Application ports and place configuration/adapters consistently. Refine the data-session interface only enough to express the actual typed query, transaction, locking, version, and cancellation responsibilities; avoid a generic repository framework. Remove irrelevant copied labels and regenerate affected PNGs with the documented renderer. Split very wide class views where necessary for readable review at ordinary document width.

**Verification:** Manually follow login and a multi-record board/closure write through prose and diagrams and confirm that the same types own each decision. Later use compiler and review checks for dependency/file conventions, rather than architecture tests. Relevant baseline: L2-036, L2-040, L2-041, L2-042 and AGENTS.md.

### A16 — Reduce policy duplication and make token mirroring deterministic

**Evidence:** Feature pages repeat the same authentication, responsive, styling, keyboard, and ATDD paragraphs. Shared type families are repeated in diagrams. [Design-language delivery](detailed-designs/artifacts/review-design-language/README.md#description) proposes copying authoritative tokens and Sass breakpoint sources to frontend/mocks through a documented copy step and manual review; the exact command/version provenance is not yet specified.

**Impact:** Small policy changes require many edits and can leave contradictory copies. Manually mirrored token/breakpoint files can diverge despite every component using the correct prefix.

**Feedback:** Keep feature-specific behavior and the required Overview/Description/Requirements/Diagrams structure, while linking cross-cutting prose to a canonical decision document. Retain explicit feature exceptions. Define a deterministic build/copy command for both token and breakpoint mirrors and record their source revision. This is build tooling plus manual artifact review, not an artifact or architecture test. Preserve the standalone design-system package/build/site and its lack of application runtime dependencies.

**Verification:** Manually build the standalone catalog and inspect the mirrored token/breakpoint provenance during review. Do not add tests for the design system, mocks, naming, folder structure, or specification traceability. Relevant baseline: L2-047, L2-048 and AGENTS.md.

## Recommended order of follow-up work

1. Resolve the frontend workflow contracts: assignee lookup (A01), page-independent sprint selections (A02), and single-owner board mutation/reconciliation (A03).
2. Establish the shared request/session protocol (A04), scoped feature state and invalidation (A05), and bounded related collections/review projections (A06–A07).
3. Record the selected Angular version and loading/rendering policy (A08). At the SQL-provider gate, settle isolation, typed transaction responsibilities, ordering constraints, and query/lock cases (A13–A15).
4. Fix the measurement pass rules and timing boundaries (A09–A11), then clarify closure revision/conflict feedback (A12). Clean up shared documentation/token provenance (A16).
5. Implement one behavior at a time: update linked Given–When–Then criteria, run the expected failing API/Chromium acceptance check, implement minimally, and run relevant regression checks before advancing. Frontend acceptance tests retain interface-token mocks and page objects; production HTTP performance runs remain separate release tooling. No artifact or architecture tests are needed.

## Design readiness checklist

- [x] P1 findings A01, A02, A03, A04, and A09 have explicit decisions and updated affected designs.
- [x] Assignee, parent, story, and destination pickers have permitted bounded query contracts and preserve drafts/selections across paging.
- [x] Concurrent consumers have defined data ownership, cleanup, request identity, and invalidation behavior.
- [x] Board mutation success, failure, conflict, and uncertain outcomes reconcile persisted state without overwriting a newer acknowledged result.
- [x] Initial and cumulative frontend loading are bounded; related collections and closure review have authoritative paged projections.
- [ ] Angular/framework/provider versions and dependent deployment/security decisions are recorded at the already documented implementation gates.
- [x] Closure conflicts can be produced truthfully from the persisted revision/event model.
- [x] Performance records distinguish successes from rejections, startup from navigation/login, and response-start from full server processing.
- [x] The agreed workload has successful per-class samples, real production HTTP composition, and complete environment/cache metadata.
- [x] No measured-performance or runtime-readiness claim is made until production implementation and the agreed runs exist.

These checklist items are review feedback. They do not approve proposed product defaults, change the L2 baseline, or claim that any runtime acceptance criterion has passed.

## Resolution

**Date:** 2026-10-01

Each finding was verified against the designs and resolved in the design documents and mocks.
The decisions below are design proposals; they do not change the L2 baseline. Cross-cutting rules
now live once in the overview's [Shared design rules](detailed-designs/README.md#shared-design-rules),
and feature pages link to them.

| ID | Decision | Where |
| --- | --- | --- |
| A01 | `ListAssigneeChoicesQuery` (`GET /api/workspaces/{workspaceId}/assignee-choices`): active users only, ID and display name, paged, readable by Administrators and Collaborators; `IAssigneeService`/`ASSIGNEE_SERVICE`; account endpoints stay administrator-only. The form picker is a debounced combobox; detail/edit data carries the current assignee with an active flag. | [Edit, assign, and reparent work](detailed-designs/work/edit-and-reparent-work/README.md); [work item form mock](mocks/work/work-item-form-dialog.html) states `assignee-search`, `assignee-no-match`, `assignee-failed`, `rejected` |
| A02 | Sprint plans save a versioned delta (`addStoryIds`, `removeStoryIds`); only additions are validated as new allocations, so existing Done members are retained. Candidates and members page independently; pending choices survive search and paging. | [Plan sprints](detailed-designs/scrum/plan-sprints/README.md); [sprint planning mock](mocks/scrum/sprint-planning.html) state `paged` |
| A03 | One pending placement mutation per board; other moves, drag, and Load more pause. Reads and results carry board identity and request generation; stale results are discarded. Success re-reads the source and destination columns, which become the latest acknowledged state and the only rollback target; uncertain outcomes re-read before another move. | [Move and reorder story cards](detailed-designs/kanban/move-story-cards/README.md), [Execute work on the active sprint board](detailed-designs/scrum/execute-sprint-work/README.md); `pending` states on the [Kanban](mocks/kanban/kanban-board.html) and [sprint](mocks/scrum/sprint-board.html) boards |
| A04 | `SessionService` owns the token, a session generation, and the capability summary; `sessionInterceptor` attaches the token, captures the generation, aborts on session end, discards stale results, routes `401` to a single `end(Unauthorized)` and `403` to `refreshCapabilities()`. Proactive expiry, no protected root caches or browser storage, and route-owned state destroyed on the way to login. | [Session handling](detailed-designs/README.md#session-handling); [Sign in and end a session](detailed-designs/identity/sign-in-and-end-session/README.md); [Navigate with context](detailed-designs/workspace/navigate-and-recover-input/README.md); [sign-in mock](mocks/auth/login.html) state `session-save-unknown` |
| A05 | Reads return a caller-owned signal resource (`ResourceRef<T>`) created by the `api` adapter, which keeps observable-to-signal conversion inside `api` as AGENTS.md requires; mutations return promises. Each consumer owns its resources; invalidation is a reload by the owning page. Shared views were split where consumers differ (work, leads, workspaces, sprints, home sections). | [Frontend data ownership](detailed-designs/README.md#frontend-data-ownership); the affected feature pages |
| A06 | Collapsing a hierarchy branch destroys its loaded descendants; board columns keep appended batches only while the board is open; counts never come from rendered rows. Release tooling records retained card/node counts and memory trend; windowing is added only if that measurement fails. | [Loading, rendering, and retention](detailed-designs/README.md#loading-rendering-and-retention); [Measure release workflow performance](detailed-designs/operations/measure-release-performance/README.md) |
| A07 | Lead detail and lead-delete conflicts return a count plus at most 10 workspaces, and no URL; the client adds a View all link, built from the lead ID, to the project list filtered by responsible lead; workspace-delete conflicts return counts only; sprint history pages outcomes and scope changes separately; closure uses a paged `GetSprintClosureReviewQuery` with a "Set all" choice plus overrides and the reviewed version. | [Find and read lead contacts](detailed-designs/leads/find-contacts/README.md), [Delete a lead](detailed-designs/leads/delete-contact/README.md), [Manage workspaces](detailed-designs/projects/manage-workspaces/README.md), [Read sprint history](detailed-designs/scrum/read-sprint-history/README.md), [Close a sprint](detailed-designs/scrum/close-sprint/README.md); mock states [`by-lead`](mocks/projects/project-list.html), [`many-unfinished`](mocks/scrum/close-sprint-dialog.html) |
| A08 | Eager essential shell, lazy feature routes, no blanket preloading, OnPush or the selected version's equivalent, `track` by stable IDs, `computed` projections, and build budgets set from measured output at the Angular-version gate. | [Loading, rendering, and retention](detailed-designs/README.md#loading-rendering-and-retention) |
| A09 | Expected statuses per operation class; unexpected 4xx/5xx fail the run; successful-operation p95 reported apart from rejections with a minimum successful sample count; open-loop pacing with offered and completed rates; uncontended baseline plus a separately labeled contention scenario; no retries. | [Measure release workflow performance](detailed-designs/operations/measure-release-performance/README.md) |
| A10 | Server time runs from pipeline entry to response completion, joined to each request by `X-Correlation-ID`; `Server-Timing` time-to-headers is diagnostic only; clock, nearest-rank percentile, sample counts, and error accounting are recorded. | Same page |
| A11 | Three intervals per run: fresh context to usable shell, sign-in submit to authenticated, and authenticated navigation with a cleared HTTP cache to a usable view. The third is the proposed L2-046.2 gate; the full fresh-context journey is reported alongside. "Usable" is defined per view and never counts skeletons or spinners. | Same page; recorded as a proposal in [Retained decisions and gaps](detailed-designs/README.md#retained-decisions-and-gaps) |
| A12 | The active sprint revision changes only on membership changes or a member story's status change. A stale closure returns `409` with neutral copy and a refreshed paged review that keeps still-valid choices; no actor or time attribution. | [Close a sprint](detailed-designs/scrum/close-sprint/README.md); [close sprint mock](mocks/scrum/close-sprint-dialog.html) state `conflict` |
| A13 | A list response computes rows and total in one statement or one explicit snapshot read transaction; each home section is its own consistent response and sections may differ in time; isolation is chosen at the SQL-provider gate, without blanket Serializable. | [Reads and queries](detailed-designs/README.md#reads-and-queries); [Review home coverage and progress](detailed-designs/workspace/review-home/README.md) |
| A14 | List and card DTOs omit long descriptions; task counts and history live titles are set-based or batched; typed searches debounce about 250 ms and the resource aborts superseded reads; the workspace lock is taken first and a lock-wait timeout returns `503` with `Retry-After`, shown as an unavailable save; release tooling adds a large/hot-workspace scenario. | [Reads and queries](detailed-designs/README.md#reads-and-queries), [Persistence, concurrency, and audit](detailed-designs/README.md#persistence-concurrency-and-audit); affected feature pages |
| A15 | `IMissionControlDataSession` and the login ports `IPasswordHashService`/`IAccessTokenIssuer` are defined once; feature class views show only the typed members they use. Login no longer hashes on `UserAccount`. Copied labels such as "login remains public" were removed where they do not apply, and wide class views were split. | [Data access and security ports](detailed-designs/README.md#data-access-and-security-ports); all feature diagrams |
| A16 | Feature pages replace repeated policy paragraphs with one link to the shared rules and keep feature-specific behavior. Tokens and breakpoints mirror deterministically: the design-system build emits `dist/tokens.css` and `dist/_breakpoints.scss`, and `sync-tokens` copies them with a source version/commit header; review rebuilds and compares, without tests. | [Shared design rules](detailed-designs/README.md#shared-design-rules); [Review the standalone design language](detailed-designs/artifacts/review-design-language/README.md); [mocks README](mocks/README.md) |

Still open by design: the Angular, .NET, and SQL provider versions, isolation level, lock timeout,
and measured budgets remain `<TO SUPPLY>` at their documented gates, and no performance result is
claimed until production code and the agreed runs exist.
