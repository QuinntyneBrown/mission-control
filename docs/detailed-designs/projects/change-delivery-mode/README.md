# Change workspace delivery mode

## Overview

Administrators choose Kanban for continuous flow or Scrum for sprint delivery.

- **Delivery mode** — workspace setting that selects its board and enabled sprint actions

Switching mode retains all work and sprint records. An active sprint blocks the transition until closure.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `ProjectLayoutPage` | Routed parent page for `/projects/:workspaceId` in `frontend/projects/mission-control`, defined in [Create and manage project workspaces](../manage-workspaces/README.md); computes `canChangeMode` from the `workspaces.changeMode` capability in `currentSession` and opens `ModeChangeDialog` through `openDialog(ChangeMode)`, from `ProjectHeaderView`'s `actionRequested` output or a relayed request, with the workspace the header last resolved. It injects `TOAST_SERVICE` and reacts to the dialog's close result: `Changed` calls `modeChanged()` and shows the "Now using Kanban" or "Now using Scrum" toast; `Outdated` calls `modeChanged()` and, once the reloaded header resolves, shows the info toast that the project changed while the dialog was open, or, when the dialog relayed `unconfirmed` before it closed, the neutral info toast naming the mode the header now shows ("Community Hackathon 2026 uses Kanban now."); `CloseSprint(SprintReference)` opens `CloseSprintDialog` with that sprint's ID; no result changes nothing. While `ModeChangeDialog` stays open, its `unconfirmed` output calls `modeChanged()` at once: `revision` increments, so the header and the active tab show the persisted mode, and the re-navigation waits until the dialog closes, so the dialog stays open for the uncertain-switch recovery. On `CloseSprintOutcome` `Closed` the layout calls `refresh()` and shows the "Sprint 8 closed" toast with the result's counts through `TOAST_SERVICE`, and on `Outdated` it calls `refresh()`; while `CloseSprintDialog` stays open, its `unconfirmed` output calls `refresh()` at once, and its `forbidden` output (an unexpected `403`) shows the "Your access changed" toast through `TOAST_SERVICE`, without Retry. It implements `FormDraft` by delegating to its open dialog, and every child page's `draft` falls back to it. |
| `ProjectHeaderView` | Domain component in `frontend/projects/domain`, defined in the same slice; offers Change delivery mode under Project actions only when its `canChangeMode` input is true, renders the tabs for the current mode, and emits `workspaceLoaded` with each resolved workspace. |
| `ProjectOverviewPage`, `BacklogPage`, `KanbanBoardPage`, `SprintsPage` | Routed child pages of the layout; pass the layout's `canChangeMode` to the view that renders their paused-sprints banner (`WorkspaceOverviewView`, `BacklogView`, the Kanban `BoardView`, `SprintListView`) and relay its `changeModeRequested` output through `inject(ProjectLayoutPage).openDialog(ChangeMode)`. |
| `WorkHierarchyPage`, `WorkItemDetailPage`, `WorkItemDeleteForm` | Defined in [Delete permitted leaf work](../../work/delete-leaf-work/README.md); when a story's planned sprint is paused, the delete form offers Change delivery mode with `canChangeMode`, `WorkItemDeleteDialog` closes with `WorkItemDeleteOutcome` `ChangeMode`, and the opening page reacts to that close result by calling `inject(ProjectLayoutPage).openDialog(ChangeMode)`. |
| `ProjectFormDialog`, `WorkspaceForm` | Defined in [Create and manage project workspaces](../manage-workspaces/README.md); the edit form's Change delivery mode link closes the dialog with `ProjectFormOutcome` `ChangeMode` after the unsaved-changes check, and the layout reacts to that close result by calling `openDialog(ChangeMode)`. |
| `ModeChangeDialog` | Application dialog in `frontend/projects/mission-control`; takes the workspace from its opener as an input, hosts `ModeChangeForm`, implements `FormDraft` from the form's latest `DraftState`, and closes through `close(result: ModeChangeOutcome?)`: `Changed` on the form's `changed` output, `Outdated` on `outdated`, `CloseSprint(SprintReference)` on `closeSprintRequested`, and no result on Cancel or Escape. It relays the form's `unconfirmed` as its own output and stays open; a `403` shows its own forbidden explanation, so it relays no `forbidden` output. |
| `ModeChangeForm` | Domain component in `frontend/projects/domain`; injects `WORKSPACE_SERVICE`, receives the loaded workspace as an input, names the destination mode and what is kept, owns the pending, blocked, forbidden, and failure state in signals, and emits `changed`, `outdated`, `closeSprintRequested` with the active `SprintReference`, `unconfirmed` when the switch gets no response, and `draftChange` (never dirty; pending while the switch is in flight). |
| `IWorkspaceService`, `WORKSPACE_SERVICE` | Contract and token in `frontend/projects/api/workspace.service.contract.ts`; the mutation `changeMode(command)` returns a `Promise<void>`. Consumers import the contract only. |
| `WorkspaceService` | Production HTTP adapter in `api`; converts the observable to the promise inside `api` and holds no shared mutable state. |
| `WorkspacesController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`. |
| `Workspace` | Domain entity; `changeMode` rejects a switch while a sprint is active. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this slice uses its typed reads, `AddAuditEvent`, `BeginWorkspaceTransactionAsync`, and `SaveChangesAsync`. |

`ModeChangeDialog` opens from Change delivery mode in four kinds of place, all through the layout's `openDialog(ChangeMode)`:

- **Project actions** in the header on every project tab (`actionRequested`).
- **The paused-sprints banners** of the overview, Backlog, Board, and Sprints tabs in a Kanban project with kept sprints. Each banner view takes `canChangeMode` and emits `changeModeRequested`, and its page relays the request.
- **The edit form's read-only Delivery mode field.** `ProjectFormDialog` closes with `ProjectFormOutcome` `ChangeMode` after the unsaved-changes check, and the layout reacts to that close result by calling `openDialog(ChangeMode)`.
- **The work delete dialog's paused-sprint blocker.** Deleting a story kept in a planned sprint of a Kanban project explains that sprints are paused; `WorkItemDeleteDialog` closes with `WorkItemDeleteOutcome` `ChangeMode`, and `WorkHierarchyPage` or `WorkItemDetailPage` reacts to that close result by calling `inject(ProjectLayoutPage).openDialog(ChangeMode)`.

Every entry point appears only with `workspaces.changeMode`, which only administrators hold; otherwise each banner says that an administrator can switch the project back, and the API still answers `403`.
The dialog names the destination mode and initially focuses Cancel.
When the loaded workspace has an active sprint, `ModeChangeForm` opens in its blocked state without a request and focuses Close Sprint N; a `409` after Confirm shows the same state. Either way the explanation is announced as an alert.
Close Sprint N emits `closeSprintRequested`; the dialog closes with `CloseSprint(SprintReference)`, and the layout opens `CloseSprintDialog` with that sprint's ID and `offerSprintsLink` true unless its active child route is `sprints` ([Close a sprint and resolve unfinished work](../../scrum/close-sprint/README.md)). On `CloseSprintOutcome` `Closed` the layout calls `refresh()` and shows the "Sprint 8 closed" toast with the result's counts through `TOAST_SERVICE`, and on `Outdated` it calls `refresh()`; the mode-change dialog does not reopen, so the administrator chooses Change delivery mode again once the sprint is closed.
While `CloseSprintDialog` stays open, its `unconfirmed` output (a closure that got no response) calls `refresh()` at once, and its `forbidden` output (an unexpected `403` on the closure) shows the "Your access changed" toast through `TOAST_SERVICE`, without Retry.
`ModeChangeForm` builds the command from its workspace input (ID, mode, version, and kept sprint summaries) and sends `changeMode`; it exchanges data with the dialog through inputs and outputs only.
`ChangeDeliveryModeCommandHandler` opens `BeginWorkspaceTransactionAsync`, which takes the workspace lock first and holds it only for this switch.
Sprint start, allocation, and mode change share the workspace lock/version boundary, preventing a racing start after the check.
The command updates only `Workspace.Mode`; IDs, statuses, assignments, sibling/backlog/column order, and sprint membership remain intact.
No board backfill is needed because every story receives its Kanban `BoardPlacement` (bottom of To Do) when it is created, in either mode.

Kanban displays the continuous board and disables sprint planning, allocation, scope mutation, start, and execution.
Preserved sprint plans/history remain readable under Sprints, matching `kanban-preserved` and `kanban-paused` mocks.
Returning to Scrum restores the planned-sprint controls. A workspace with no preserved sprints has no Kanban Sprints tab.
The preserved Kanban Sprints tab is a design proposal, listed among the overview's [retained decisions](../../README.md#retained-decisions-and-gaps); the underlying retention and disabled execution follow L2-027.
A workspace with no sprints switches the same way. The dialog says there is no sprint history to restore (`to-scrum-empty`) or nothing to move (`to-kanban-empty`).
Under the lock the handler checks existence, version, and active sprint, in that order, before it writes.
A missing workspace returns `404`; the form emits `outdated`, the dialog closes with `Outdated`, and the layout calls `modeChanged()`, so the header keeps only the breadcrumb and the active tab's view shows its not-found state with Back to projects. Nothing else is announced.
A stale `expectedVersion` returns `409`; the form emits `outdated`, the dialog closes with `Outdated`, and the layout calls `modeChanged()`, so the header, the active tab, and the board follow the current mode.
`Outdated` covers both cases, so `ProjectLayoutPage` announces only once the reloaded header resolves: its info toast through `TOAST_SERVICE` says "This project changed while the dialog was open. Its current delivery mode is shown." After a `404` the header's read fails instead, and only the tab's not-found state appears.
Active-sprint conflict returns `409` and keeps the previous mode. The dialog shows the blocked state: it explains closure, offers Close Sprint N, and offers no retry.
A `403`, after the role changed while the dialog was open, keeps the dialog open, explains that only administrators change the delivery mode, and leaves the switch unavailable, so focus moves to that alert; there is no reference ID and the mode is unchanged.
A malformed command returns `400`; the dialog's alert shows the field message with no retry or reference ID, because a retry could only repeat the refusal. The switch becomes unavailable, and the dialog has no field to focus, so focus moves to that alert.
A lock-wait timeout returns `503` with `Retry-After` and no partial change, and an unexpected failure returns `500`. Either way the dialog keeps the previous mode, shows its `failed` state with the response's reference ID, and retries only when the administrator chooses.
A switch that gets no response may have committed, so the dialog never says the mode is unchanged: its `failed` alert reads "We couldn't confirm whether Community Hackathon 2026 switched to Kanban", without a reference ID.
`ModeChangeForm` emits `unconfirmed`, which the dialog relays, so the layout calls `modeChanged()` at once: `revision` increments, and the header and the active tab show the persisted mode while the dialog stays open.
The recovery depends on the dialog staying open, so the layout defers `modeChanged()`'s re-navigation, and any `sprints`→`overview` redirect, until the dialog closes; a navigation that deactivated the active child page, which hosts the dialog, would dismiss it.
The switch sends again only when chosen; if the first switch went through, the form's version is stale, so the `409` closes the dialog with `Outdated`, and the deferred re-navigation runs with that close.
The first switch may be the change the `409` reports, so the layout, which received the relayed `unconfirmed`, replaces the changed-while-open toast with a neutral one naming the mode the reloaded header shows, such as "Community Hackathon 2026 uses Kanban now."
On success the form emits `changed`, the dialog closes with `Changed`, and the layout calls `modeChanged()` and shows the "Now using Kanban" or "Now using Scrum" toast through `TOAST_SERVICE`. Its `revision` increment reloads the header and the active tab, so the tabs and summary follow the new mode, and re-navigating the current tab URL lets `BoardModeGuard` match `KanbanBoardPage` or `SprintBoardPage` for it.
If the current child route is `sprints` and the reloaded header has no Sprints tab, as after switching a project with no sprints to Kanban, the layout navigates to `overview` instead; a direct `sprints` URL for such a project redirects to `overview` the same way.
A board mutation answered with a mode-changed `409`, because the mode switched after the board loaded, calls `modeChanged()` the same way.
A committed switch registers a success `AuditEvent` (actor, operation, workspace ID, outcome, and correlation ID) through `AddAuditEvent`, which `SaveChangesAsync` commits with the new mode; a rolled-back switch leaves none. `CurrentAccountAuthorization` audits a refused `403` as `Denied`.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Confirm delivery mode change | `PUT /api/workspaces/{id}/mode` | `ChangeDeliveryModeCommand` / `ChangeDeliveryModeCommandHandler` |

Mock input and review references:

- [Change delivery mode · Mission Control mock](../../../mocks/projects/mode-change-dialog.html); review states: `to-kanban`, `to-scrum`, `to-scrum-empty`, `to-kanban-empty`, `blocked`, `saving`, `failed`.
- [Project overview · Mission Control mock](../../../mocks/projects/project-overview.html); review states: `default`, `kanban`, `new-empty`, `new-empty-collaborator`, `kanban-preserved`, `collaborator`, `not-found`, `loading`, `error`.
- [Sprints · Mission Control mock](../../../mocks/scrum/sprints.html); review states: `default`, `empty`, `kanban-paused`, `loading`, `error`.
- [Backlog · Mission Control mock](../../../mocks/backlog/backlog.html); review states: `default`, `add-to-sprint`, `kanban`, `kanban-preserved`, `collaborator`, `paged`, `empty`, `reorder-failed`, `reorder-conflict`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-027` | `L1-006` | Only administrators must switch workspace mode. An active sprint must block a mode change. Kanban mode must preserve planned/closed sprints but disable their execution until returning to Scrum; work remains available on the Kanban board. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Change workspace delivery mode: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Change workspace delivery mode: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Change workspace delivery mode: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Change workspace delivery mode: class structure](diagrams/class-structure.png)

Confirm delivery mode change follows the sequence below. The flow traces its enforcing steps to `L2-027` and includes rejection or recovery paths.

![Confirm delivery mode change](diagrams/sequence-change-mode.png)

