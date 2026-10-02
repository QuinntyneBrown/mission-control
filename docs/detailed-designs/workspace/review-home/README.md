# Review home coverage and progress

## Overview

Home brings Toronto lead coverage and project delivery into one overview.

- **Coverage count** — total persisted lead records in one of the five responsibility categories
- **Progress summary** — workspace work counts by type/status and active sprint identity

Each count links to its underlying filtered records, and empty categories show zero.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `HomePage` | Routed page owned by `frontend/projects/mission-control` at `/home`; composes the three section views and binds each one's `refresh` input to the page's own counter, reads `currentSession` through `SESSION_SERVICE`, and computes `canCreateProject` from `workspaces.manage`. With that capability it shows the header New project; without it, a neutral notice reads "You can open any project and work in it. Only administrators can add projects." It passes the flag to `WorkspaceProgressView` and opens `ProjectFormDialog` from the header button or the view's `newProjectRequested` output. When the dialog closes with `Saved(SavedWorkspaceResult)`, `HomePage` shows the "Project created" toast naming the project through `TOAST_SERVICE` and navigates to `/projects/:workspaceId`; closing with no result leaves Home as it was, and a create never closes with `NotFound` or `ChangeMode`. While the dialog stays open, its `unconfirmed` output increments the page's counter at once, so `WorkspaceProgressView` rereads Projects before the project is saved again. The dialog shows a `403` in its own `forbidden` state and relays no `forbidden` output. |
| `LeadCoverageView`, `WorkspaceProgressView`, `ActiveSprintSummaryView` | Domain components in `frontend/projects/domain`; each injects `HOME_SERVICE`, owns its own section resource, takes `refresh: InputSignal<number>`, whose change rereads that resource, derives its `SectionState` with `computed`, renders its own loading, empty, and error states, and retries only its own request. `WorkspaceProgressView` also takes `canCreateProject: InputSignal<bool>` and emits `newProjectRequested: OutputEmitterRef<void>` from its empty state. |
| `IHomeService`, `HOME_SERVICE` | Interface and token in `frontend/projects/api/home.service.contract.ts`; the consumer imports the contract only. |
| `HomeService` | Production HTTP adapter in `api`; each read member creates a caller-owned signal resource in the consumer's injection context, performs the HTTP call, and converts it to signals. It holds no shared results. Composition binds a mock adapter for Chromium Playwright. |
| `HomeController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`. |
| `LeadCoverage`, `WorkspaceProgressPage`, `ActiveSprintSummaryPage` | Application read projections, one per endpoint. Their item types (`CategoryCount`, `WorkspaceProgress`, `TypeStatusCount`, `SprintPeriod`, `ActiveSprintSummary`, `StatusCount`) each take their own file; `CategoryCount` and `SprintPeriod` are the [shared types](../../README.md#api-boundary-and-errors). No Domain entity is added. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this slice uses only its typed reads. |

`HomePage` owns `/home` and composes `LeadCoverageView`, `WorkspaceProgressView`, and `ActiveSprintSummaryView` from the domain library.
Each view consumes `IHomeService` through `HOME_SERVICE` and creates its own resource for its endpoint: `leadCoverageResource(query)`, `workspaceProgressResource(query)`, or `activeSprintSummaryResource(query)`.
Each takes its query as a function that may return `undefined`, and returns the shared `ResourceRef` (`value`, `status` of `loading`, `resolved`, or `error`, `error`, and `reload()`) owned by that view, so one section's load or failure never changes another.
Each view's `state` is a `computed` `SectionState` of `Loading`, `Ready`, `Empty`, or `Failed`, with the reference ID when the failed response carried one.
A resource reads when its view is created, so every activation of `/home` refetches all three sections; `retry()` calls only that section's `reload()`.
Destroying a view aborts its in-flight read.
No cross-view cache exists. Home itself is read-only: its only mutation entry, New project, opens `ProjectFormDialog` without a workspace ID, from the header or from the Projects empty state.
The dialog closes through its typed outcome ([Create and manage project workspaces](../../projects/manage-workspaces/README.md) defines it). On `Saved(SavedWorkspaceResult)`, `HomePage` shows the "Project created" toast naming the project and navigates to `/projects/:workspaceId`; the next visit to Home refetches persisted totals. A cancelled form changes nothing and triggers no read.
A create that gets no response may have committed, so the dialog stays open with the draft and relays the form's `unconfirmed` output. `HomePage` increments its counter at once, so `WorkspaceProgressView` rereads Projects before the project is saved again, and Save project resends only when pressed.
`HomePage` hosts that dialog, so it implements `FormDraft` by delegating to it and `/home` registers `UnsavedChangesGuard`, as the [navigation design](../navigate-and-recover-input/README.md) describes.
The API runs grouped SQL counts over all persisted records, not client-loaded pages.
`GetLeadCoverageQuery` has no parameters, so the coverage view's query function always returns the same empty query; it returns all five categories with their `totalCount`, and absent categories count zero.
Work counts group each work item once by type and status, and absent type and status pairs count zero; `workItemTotal` counts every item of the workspace, and each active sprint carries its story counts by status and `storiesTotal`.
A type's Total column adds that type's three status counts from the same response; no count or total comes from loaded rows.
Project summaries are list rows, so they carry no description; the project overview shows it.
Project and active-sprint lists are paged, defaulting to 25 and capped at 100; work totals are not truncated with the list.
Projects order by name, then ID; active sprints order by workspace name, then sprint ID, so paging stays stable.
Each page carries `totalCount`. The Projects hint reads "N projects · View all projects" and the Active sprints hint "N active sprints"; when `totalCount` exceeds the loaded page, either hint reads "Showing 25 of N · View all projects", since the project list and each project's Sprints tab reach the rest.
Separate summary endpoints let each section load, fail, and retry alone: the `section-error` mock retries Projects while Leads and Sprints remain visible.
While loading, each section keeps its heading and shows its own skeleton and loading announcement (the `loading` mock).
When every section request fails, each section shows its own error with its reference ID and Retry (the `error` mock); a section whose read gets no response shows the same alert with Retry and no reference ID. `HomePage` holds no section state, so it shows no page-level error and keeps New project available.
Home reads need no capability beyond an active account, so no section has a `403` path.
A `401` from any section ends the session once through `end(Unauthorized)` ([session protocol](../../identity/sign-in-and-end-session/README.md)), and sign-in opens with the session-ended message.
Section responses that arrive after the session ended are discarded, and their resources keep their state.

Category links set directory filters (`?category=`); type/status counts set workspace work-list filters (`status=todo`, `in-progress`, or `done`); sprint names open the matching board.
Each section response is computed in one SQL statement, with its total from a window count, or inside one explicit snapshot-isolation read transaction when it needs several statements.
Rows, totals, and grouped counts within one response therefore come from one snapshot; a default read transaction alone does not guarantee that and is not relied on.
The provider-specific isolation setting is chosen at the SQL-provider gate, and no blanket `Serializable` isolation is used.
Separate sections may reflect different instants; Home claims no single cross-section snapshot.
The first-run administrator sees the seeded City contact and permitted New project action; a collaborator sees the page notice and an explanatory empty state instead.
Active sprints reads only sprints in progress, so whenever none exists, first run included, it shows one empty message that points to a project's Sprints tab, with View projects.
Compact layouts stack cards. Primary navigation and creation controls follow current permissions.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Read all five lead category totals | `GET /api/home/lead-coverage` | `GetLeadCoverageQuery` / `GetLeadCoverageQueryHandler` |
| Read workspace progress summaries | `GET /api/home/projects` | `GetWorkspaceProgressQuery` / `GetWorkspaceProgressQueryHandler` |
| Read active sprint summaries | `GET /api/home/active-sprints` | `GetActiveSprintSummaryQuery` / `GetActiveSprintSummaryQueryHandler` |

Mock input and review references:

- [Home · Mission Control mock](../../../mocks/home/home.html); review states: `default`, `collaborator`, `first-run-admin`, `first-run-collaborator`, `no-active-sprints`, `loading`, `error`, `section-error`.
- [Work list · Mission Control mock](../../../mocks/work/work-list.html); review states: `default`, `zero-results`, `filter-invalid`, `loading`, `error`.
- [Lead directory · Mission Control mock](../../../mocks/leads/lead-directory.html); review states: `default`, `collaborator`, `category`, `filtered`, `zero-results`, `page-2`, `filter-invalid`, `deleted`, `empty-admin`, `empty-collaborator`, `loading`, `error`.
- [Project overview · Mission Control mock](../../../mocks/projects/project-overview.html); review states: `default`, `kanban`, `new-empty`, `new-empty-collaborator`, `kanban-preserved`, `collaborator`, `not-found`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-003` | `L1-001` | The client must hold the token in memory, clear it on logout, and require login after reload or expiry. Local logout does not revoke a copied valid access token. |
| `L2-005` | `L1-001` | The API and UI must apply permission profile P. Lead category or contact creation must not create a login or change a user's authorization. |
| `L2-027` | `L1-006` | Only administrators must switch workspace mode. An active sprint must block a mode change. Kanban mode must preserve planned/closed sprints but disable their execution until returning to Scrum; work remains available on the Kanban board. |
| `L2-028` | `L1-007` | Home must show all five lead categories with counts, project names/modes, per-workspace work-item counts by type and status, and active Scrum sprint names. Totals must be computed from persisted records rather than visible pages. |
| `L2-030` | `L1-008` | Every login/session, account-management, lead CRUD, workspace, hierarchy, backlog, board, sprint, home, and navigation workflow must satisfy responsive profile R. Compact layouts must stack form fields and summary cards and provide local board scrolling or a column selector. Larger layouts must use available space without overlapping controls. Vertical page scrolling is permitted. |
| `L2-032` | `L1-008` | Production views must use the application design tokens and consistent typography, spacing, focus, form, and status patterns. Loading, empty data, zero search results, and request errors must be distinguishable and offer relevant actions. Visual review is for application UX; design artifacts themselves remain exempt from automated tests. |
| `L2-034` | `L1-009` | Application controls must expose programmatic names and roles. Inputs must have associated labels; field errors must identify their inputs. Pages must expose main/navigation regions and a coherent heading hierarchy. Asynchronous outcomes must be announced without relying only on visual changes. |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Review home coverage and progress: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Review home coverage and progress: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, the three read projections, and the one-snapshot section reads.

![Review home coverage and progress: c4 component](diagrams/c4-component.png)

The class view shows the view-owned section resources and state with their refresh inputs, the New project input and output, the dialog outcome and `unconfirmed` output Home reacts to, the contract, and the typed requests.

![Review home coverage and progress: class structure](diagrams/class-structure.png)

Read all five lead category totals follows the sequence below. The flow traces its enforcing steps to `L2-028`.
It covers the `401` path, a read with no response, and the section-only `500` path; the query has no input, so no `400` path exists.

![Read all five lead category totals](diagrams/sequence-leads.png)

Read workspace progress summaries follows the sequence below. The flow traces its enforcing steps to `L2-028`.
It covers the `401`, page-size `400`, no-response, and section-only `500` paths, the empty and ready states, and the created and unconfirmed project outcomes.

![Read workspace progress summaries](diagrams/sequence-projects.png)

Read active sprint summaries follows the sequence below. The flow traces its enforcing steps to `L2-028`.
It covers the `401`, page-size `400`, no-response, and section-only `500` paths, and the empty and ready states.

![Read active sprint summaries](diagrams/sequence-sprints.png)

