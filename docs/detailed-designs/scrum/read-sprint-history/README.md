# Read immutable sprint history

## Overview

Sprint history preserves the actual decisions and delivery outcomes of closed work periods.

- **Recorded outcome** — story identity, title, closure status, and destination captured when the sprint closes

Live stories may later change or disappear. History remains a readable record of its original closure.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `SprintHistoryPage` | Routed page owned by `frontend/projects/mission-control` for `/projects/:id/sprints/:sprintId/history`, outside `ProjectLayoutPage`. It reads the workspace through `WORKSPACE_SERVICE` (`workspaceResource`) for the breadcrumb and passes its name to the view; a `404` for the workspace shows Project not found with Back to projects (`project-not-found`). It composes `SprintHistoryView`, binding its `refresh` input to the page's own counter; the page opens no dialogs, so only `retryRequested` changes it: the page reloads its workspace resource and increments the counter, so the breadcrumb and the history reread together. |
| `SprintHistoryView` | Domain component in `frontend/projects/domain`; injects `SPRINT_SERVICE` and owns the header, outcome, and scope-change resources and their page signals. A change of its `refresh` input rereads all three and keeps both pages; its `workspaceName` input names the project in the not-found copy, and a failed read's Try again emits `retryRequested`. Story, destination, and back links are router links. |
| `ISprintService`, `SPRINT_SERVICE` | Interface and token in `frontend/projects/api/sprint.service.contract.ts`; consumers import the contract only. |
| `SprintService` | Production HTTP adapter in `api`; each history read is a caller-owned signal resource that aborts a superseded request. Composition binds a mock adapter for Chromium Playwright. |
| `SprintsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `SprintSnapshot`, `SprintStoryOutcome` | Immutable closure records written by the close-sprint slice. |
| Initial scope, `SprintScopeChange` | Immutable child rows of the sprint written by the start-and-adjust-sprint slice at start and at each scope change; closure references them and copies nothing. |
| `SprintHistoryHeader`, `SprintOutcomeRow`, `SprintScopeChangeRow` | Application read models through which this slice reads those records. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this feature uses only `LoadSprintHistoryHeaderAsync`, `ListSprintOutcomesAsync`, and `ListSprintScopeChangesAsync`. |

`SprintHistoryPage` owns `/projects/:id/sprints/:sprintId/history`; `SprintsPage` links to closed records newest closure first, then ID.
History reads the immutable snapshot, initial-scope, and scope-change records, not mutable WorkItem values, as the historical truth. Three reads page independently:

- `GetSprintHistoryQuery { workspaceId, sprintId }` returns the header: name, goal, planned dates, start and close instants with their recorded actors, initial and final scope counts, and the completed, carried-over, and returned counts over all outcomes. The Sprints tab's closed rows show the same three counts.
- `GetSprintOutcomesQuery { workspaceId, sprintId, page, pageSize }` pages the recorded story outcomes as `SprintOutcomeRow` items in the order recorded at closure, with story ID as the tie-breaker. Each carries its recorded destination as a `SprintReference`.
- `GetSprintScopeChangesQuery { workspaceId, sprintId, page, pageSize }` pages the recorded scope changes as `SprintScopeChangeRow` items, newest first (`atUtc` descending), then story ID. Each change is immutable once recorded, so the active sprint board's Scope changes panel uses the same query.

Both lists default to 25, cap at 100, and return their totals; a longer list gets its own pager.
An invalid page or page size returns `400`. The view always asks for valid pages of 25, so only a direct API caller meets it; a section that did would show the page-size message without Try again or a reference ID, because repeating the read would be refused again.
The start and close entries of the scope log come from the header, so they stay visible on every scope-change page.
The persisted records (the snapshot header with its outcome rows, and the sprint's initial-scope and scope-change rows) are separate from these read models.
Initial scope, scope changes, and outcomes preserve recorded IDs even after live item deletion. No cascade connects them to live work.

For each outcome page, one batched lookup reads which of that page's recorded story IDs still exist and their current titles; no row issues its own query.
The lookup decides only whether a story links and whether a current-title note shows; it never overwrites recorded text or status.
The `renamed` mock shows the recorded title with an additional current-title note.
A story deleted after closure keeps its recorded key, title, and status as plain text with a Deleted label and no link, so navigation never breaks.
Scope-change rows show their recorded actor, instant, story key and title, and Add/Remove text without a live lookup.
Carryover destinations show the sprint name recorded at closure and link to that sprint; sprints are never deleted, so the link resolves.
Planned Toronto dates remain calendar values; actual instants store UTC and display Toronto time.
Closed sprint mutation handlers return `409`; no snapshot edit endpoint exists.
History stays available during Kanban mode.
A missing sprint, or one in another workspace, returns `404` for every read. Header and outcome reads also return `404` for a sprint that has not closed; the view shows Sprint not found with Back to sprints (`not-found`).
A missing workspace returns `404` too; the page's own workspace read decides it and shows Project not found with Back to projects instead (`project-not-found`).
A failed read shows Load failed with Try again (`error`); the reference ID shows only when the read was answered with a `500`, and a read that gets no response shows the same state without one.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Read recorded closure outcomes | `GET /api/workspaces/{id}/sprints/{sprintId}/history`, `GET .../history/outcomes`, `GET .../history/scope-changes` | `GetSprintHistoryQuery`, `GetSprintOutcomesQuery`, `GetSprintScopeChangesQuery` / their handlers |

Mock input and review references:

- [Sprint history · Mission Control mock](../../../mocks/scrum/sprint-history.html); review states: `default`, `renamed`, `not-found`, `project-not-found`, `loading`, `error`.
- [Sprints · Mission Control mock](../../../mocks/scrum/sprints.html); review states: `default`, `empty`, `kanban-paused`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-018` | `L1-004` | Only administrators must delete work, after confirmation naming the item. Deletion must be blocked while children exist or a story belongs to a planned or active sprint. Closed sprint history must survive a later permitted deletion. |
| `L2-023` | `L1-006` | A workspace must have at most one active sprint. Starting must transition a planned sprint to Active and record the start instant. Active sprint scope can be changed explicitly by permitted users, without losing the recorded initial scope. |
| `L2-026` | `L1-006` | Closed sprint history must preserve its name, goal, planned dates, actual start/ close instants, initial and final scope, and story IDs, titles, statuses, and carryover destinations as recorded at closure. Later edits, reparenting, or permitted deletions must not rewrite these recorded outcomes. |
| `L2-027` | `L1-006` | Only administrators must switch workspace mode. An active sprint must block a mode change. Kanban mode must preserve planned/closed sprints but disable their execution until returning to Scrum; work remains available on the Kanban board. |
| `L2-029` | `L1-007` | Primary navigation must reach Home, Leads, and Projects, with account management visible only to administrators. Work details must expose their workspace and parent path. Direct routes must enforce authentication and handle missing records. |
| `L2-032` | `L1-008` | Production views must use the application design tokens and consistent typography, spacing, focus, form, and status patterns. Loading, empty data, zero search results, and request errors must be distinguishable and offer relevant actions. Visual review is for application UX; design artifacts themselves remain exempt from automated tests. |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Read immutable sprint history: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Read immutable sprint history: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Read immutable sprint history: c4 component](diagrams/c4-component.png)

The class view shows the page with its workspace read and `refresh` counter, the history view, the proposed typed requests, interface consumption, and relationships between the feature parts.

![Read immutable sprint history: class structure](diagrams/class-structure.png)

Read recorded closure outcomes follows the sequence below. The flow traces its enforcing steps to `L2-026` and includes rejection or recovery paths.

![Read recorded closure outcomes](diagrams/sequence-read.png)

