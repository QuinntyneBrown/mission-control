# Confirm story completion with unfinished tasks

## Overview

A story can be complete even while tasks remain unfinished, but the decision requires explicit review.

- **Completion condition** — versioned summary of the story's current task completion state

The same guard applies to Kanban, sprint boards, and direct story status edits. Confirming changes the story alone.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `WorkItemDetailPage` | Routed page owned by `frontend/projects/mission-control`, defined by [Create and navigate the work hierarchy](../../work/create-and-navigate-work/README.md); composes `WorkItemDetailView`, opens `UnfinishedTasksDialog` when the view's `completionStatus` output reports that confirmation is required, drives the dialog's `prompt` from that output, and relays the dialog's choice back through the view's `completionDecision` input. On a `completionStatus` of `Forbidden` it shows the "Your access changed" toast through `TOAST_SERVICE`; it calls no other service for this feature. When the dialog closes with `Settled` or `Forbidden`, focus returns to the status control. When it closes with no result, because a navigation closed it, the page relays `kept` through `completionDecision`, so the view drops its pending completion without a request. The view's own reload and the status announcement need nothing more from the page, apart from the layout's `refresh()` on the view's first `notFound`. |
| `MoveStoryDialog` | Application dialog in `frontend/projects/mission-control`, opened by `KanbanBoardPage` and `SprintBoardPage` with a `MoveRequest` ([moves](../move-story-cards/README.md)); a Done destination emits the `chosen` move that can return the confirmation, and the dialog then closes with `ConfirmationRequired` (`close(result: MoveStoryOutcome?)`), so its opener opens `UnfinishedTasksDialog` in its place. |
| `UnfinishedTasksDialog` | Application dialog in `frontend/projects/mission-control`, opened by `KanbanBoardPage`, `SprintBoardPage`, `WorkItemDetailPage`, and `WorkItemFormDialog` (the edit form); shows the story's key, title, and saved status, the count, and in its `failed` state the reference ID from its `prompt` input, focuses Keep in progress, and emits `confirmed(condition)` on Mark story Done or `kept` on Keep in progress or Escape to its opener. It closes through `close(result: UnfinishedTasksOutcome?)` with `Settled` or `Forbidden` when its `prompt` reports that state, and is never dismissed without a choice, except that, like any dialog, it closes with no result once a navigation leaves its page or changes that page's route parameters (another item on the detail page); its opener then relays `kept`, so the component that sent the refused command drops its pending change without a request. |
| `WorkItemDetailView` | Domain component in `frontend/projects/domain`, defined by [Create and navigate the work hierarchy](../../work/create-and-navigate-work/README.md); injects `WORK_ITEM_SERVICE`, owns its `workItemResource` and the status control, sends `complete`, and reports each attempt through its `completionStatus` output: confirmation required with the returned condition, saving, failed, forbidden, or settled. A `completionDecision` input to mark the story Done resubmits `complete` with that condition. |
| `IWorkItemService`, `WORK_ITEM_SERVICE` | Contract and token in `frontend/projects/api/work-item.service.contract.ts`; the read member `workItemResource(query)` returns a caller-owned `ResourceRef<WorkItemDetail>`, and the mutation `complete(command)` returns a `Promise<CompleteStoryResult>`. Consumers import the contract only. |
| `WorkItemService` | Production HTTP adapter in `api`; creates each resource in the consumer's injection context, converts observables to signals or promises, aborts a superseded read when the query signal changes, and cancels reads on consumer destroy; no shared mutable state. Composition binds a mock adapter for Chromium Playwright. |
| `WorkItemsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `StoryStatusTransition` | Application service in `backend/src/MissionControl.Application`, used by `MoveStoryCommandHandler`, `UpdateWorkItemCommandHandler`, and `CompleteStoryCommandHandler` for every story status change. It applies `StoryCompletionPolicy` before any change, sets the status, moves every live placement, and increments the active sprint's version when the story is a member. |
| `StoryCompletionPolicy` | Domain rule in `backend/src/MissionControl.Domain`: a Done transition needs confirmation when the story has unfinished tasks and the sent `StoryCompletionCondition` is absent or no longer matches the current one. |
| `StoryCompletionCondition` | Domain value in `backend/src/MissionControl.Domain`: the unfinished count, story version, and task revision that a Done confirmation must match. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md); this feature uses `BeginWorkspaceTransactionAsync`, `LoadStoryPlacementsAsync`, `AddAuditEvent`, and `SaveChangesAsync`. |

After `BeginWorkspaceTransactionAsync` takes the workspace lock, `LoadStoryPlacementsAsync` reads the story, its live placements, and its `taskRevision`.
The unfinished count is one aggregate over the story's child-task statuses, not a per-task read.
`StoryStatusTransition` applies `StoryCompletionPolicy`, which compares that current condition with the one the request sent.
A lock-wait timeout returns `503` with `Retry-After` and no change; every caller treats it as an unavailable save.
A story's `taskRevision` increments in the same transaction whenever one of its tasks is created, has its status edited, is reparented (for both the old and the new parent story), or is deleted.
That increment is the only change a task makes to its story: it changes neither the story's `version` nor a sprint's version, so a resubmission still passes the story-version check, and a changed condition returns the new `409` `unfinished-tasks` (`server-count`) rather than a stale-version `409`.
The work slices implement those increments: [create](../../work/create-and-navigate-work/README.md), [edit and reparent](../../work/edit-and-reparent-work/README.md), and [delete](../../work/delete-leaf-work/README.md).
The completion condition compares `taskRevision` and the unfinished count, so any of those task changes after the `409` requires a fresh confirmation.
A Done request with no tasks or all tasks Done proceeds without confirmation.
Otherwise it returns `409` with a specific `unfinished-tasks` category and a `StoryCompletionCondition`: current count, story version, and task revision.
Any board (Kanban or sprint), the story detail, or the story edit form then opens `UnfinishedTasksDialog`.
The dialog initially focuses Keep in progress and names the story (key, title, and saved status) and the unfinished count.
It shows the count only; it lists no task titles and names no one who changed a task.

`UnfinishedTasksDialog` emits `confirmed(condition)` or `kept` to the page or dialog that opened it; it never calls a domain component. Escape is Keep in progress and emits `kept`; while a resubmission is pending, Keep in progress is disabled and Escape does nothing.
Mark story Done resubmits the refused command unchanged except for the returned `StoryCompletionCondition`.
Every opener relays the choice to the domain component that sent the refused command, and that component resubmits it:
a board page passes it to `BoardView` through `completionDecision`, and the view resubmits `MoveStoryCommand` with the same destination and position;
`WorkItemDetailPage` passes it to `WorkItemDetailView` through `completionDecision`, and the view resubmits `CompleteStoryCommand`;
`WorkItemFormDialog` passes it to `WorkItemForm`, which resubmits its `UpdateWorkItemCommand` as [edit work](../../work/edit-and-reparent-work/README.md) describes.
The change stays pending while the dialog is open; on a board this follows the single-pending-move rule in [moves](../move-story-cards/README.md).
When a navigation closes the dialog with no result, its opener relays `kept` as if Keep in progress were chosen (through `completionDecision`, or to `WorkItemForm`), so the sending component drops its pending change and sends nothing.
The opener drives the dialog's `prompt` from the sending component's status output (`moveStatus` on a board, `completionStatus` on the detail and the edit form): `saving` while the resubmission is pending, `server-count` when the count changed, `failed` with the reference ID when the save was unavailable, and `Settled` or `Forbidden` once the status reports it, which closes the dialog with that result.
Each opener's reaction to that close result is focus only, described below; toasts and reloads follow the status output, which also covers attempts made without the dialog.
Each status carries what the prompt shows: the story's key, title, and saved status, the condition, and the reference ID.
The server rechecks the condition under the lock before any write. A changed revision/count returns a new `409` and the `server-count` mock state requests fresh confirmation.
A changed story version, which only a change to the story itself makes, is a stale-version `409`: the status reports `Settled`, so the dialog closes, a board restores its latest acknowledged state and offers Reload board, and the detail reloads its `workItemResource` once to show the latest story.
Keep in progress, or Escape, sends no request: a board restores its latest acknowledged state and the detail keeps the saved status.
An unexpected `500` or a `503` lock-wait timeout reports `Failed` with the reference ID, which keeps the dialog open in its `failed` state; Mark story Done retries the same request.
Without the dialog, the detail status control keeps the saved status and shows the reference ID with Try again, which resends the same request (the detail mock's `status-failed` state).
A request with no response (a timeout or network failure) is an uncertain outcome: the story may or may not be Done, so nothing claims that it is unchanged and nothing is resent.
`WorkItemDetailView` reloads its `workItemResource` once and, when the read settles, reports `Settled`, which closes any open dialog, and announces the persisted status; the status control's `status-failed` presentation says "We couldn't confirm the status change" and names the persisted status, never "Nothing changed", without a reference ID or Try again. `UnfinishedTasksDialog` never shows its `failed` state for this case.
If that read fails too, the detail shows its load error with Try again (the detail mock's `error` state). A board likewise re-reads its affected columns after a move with no response, as [moves](../move-story-cards/README.md) describe.
A `400` on the detail (a malformed body, or an item that isn't a story) reports `Settled`: the status control keeps the saved status and shows the message, linked to the control, which keeps focus and reads it, without Try again or a reference ID.
A `404` on the detail (the story, or its project, was deleted) reports `Settled`, which closes any dialog, and `WorkItemDetailView` rereads its `workItemResource` once. That read's `404` category decides the outcome: `item-not-found` shows the item's not-found state, and `workspace-not-found` shows the project's not-found presentation and emits `notFound`, on which `WorkItemDetailPage` calls the layout's `refresh()`.
Completing a story needs only an active session (profile P), so a `403` is unexpected. It still triggers the capability refresh (session rules), keeps the saved status, and reports `Forbidden`, which closes any open dialog.
The opener's routed page then shows the "Your access changed" toast through `TOAST_SERVICE`, without Retry or a reference ID: `WorkItemDetailPage` for the detail, and the board page for a board move as [moves](../move-story-cards/README.md) describe.

Success updates story status and live placements without changing any task status.
`CompleteStoryCommandHandler`, `MoveStoryCommandHandler`, and `UpdateWorkItemCommandHandler` all change status through `StoryStatusTransition`, so the guard, the placement updates, and the sprint version rule exist once.
When the story belongs to the active sprint, the transition increments that sprint's version in the same transaction, as the [closure revision matrix](../../scrum/close-sprint/README.md#description) lists.
`WorkItemDetailView` then reloads its own `workItemResource`, whether it sent the first request or the resubmission. A board re-reads its affected columns as described for moves.
The dedicated endpoint below supports the detail status control; it does not bypass the shared guard.

Focus stays on Mark story Done while the resubmission is pending; it reports `aria-disabled`, so it keeps focus while Keep in progress is disabled.
`server-count` and `failed` are announced through the dialog's alert region without moving focus; `server-count` names the new count in its alert, which also becomes the dialog's description.
When the dialog closes, focus returns to the control that changed the status: the status control on the detail, or the card's Move button on a board, unless a board alert, the board region (story deleted), or the not-found heading takes focus as [moves](../move-story-cards/README.md) describe. On the detail, a `404` that replaces the status control with a not-found state moves focus to that state's heading.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Confirm current unfinished-task condition | `PUT /api/workspaces/{id}/work-items/{storyId}/completion` | `CompleteStoryCommand` / `CompleteStoryCommandHandler` |

Mock input and review references:

- [Unfinished tasks confirmation · Mission Control mock](../../../mocks/kanban/unfinished-tasks-dialog.html); review states: `default`, `server-count`, `saving`, `failed`.
- [Move story · Mission Control mock](../../../mocks/kanban/move-story-dialog.html); review states: `default`, `to-done`, `saving`, `failed`.
- [Work item detail · Mission Control mock](../../../mocks/work/work-item-detail.html); review states: `default`, `status-failed`, `initiative`, `epic`, `task`, `unset`, `inactive-assignee`, `collaborator`, `not-found`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-021` | `L1-005` | Marking a story Done while it contains unfinished tasks must require an explicit confirmation showing the unfinished count. Confirmation must not silently mark tasks Done. The rule applies to Kanban, Scrum, and direct story status edits. |
| `L2-024` | `L1-006` | An active sprint board must show only its currently allocated stories, using the same status columns, task counts, and accessible move behavior as Kanban. Story status is shared across backlog, hierarchy, and sprint views. |
| `L2-031` | `L1-008` | Forms must expose field-specific validation, retain input on rejected saves, prevent duplicate submission while pending, display results, and confirm leaving with unsaved edits. Destructive confirmations must name the affected item. |
| `L2-033` | `L1-009` | Every application workflow must be operable by keyboard without required dragging. Focus must remain visible, follow a logical sequence, and be managed when dialogs open/close and routed content changes. |
| `L2-034` | `L1-009` | Application controls must expose programmatic names and roles. Inputs must have associated labels; field errors must identify their inputs. Pages must expose main/navigation regions and a coherent heading hierarchy. Asynchronous outcomes must be announced without relying only on visual changes. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Confirm story completion with unfinished tasks: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Confirm story completion with unfinished tasks: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Confirm story completion with unfinished tasks: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Confirm story completion with unfinished tasks: class structure](diagrams/class-structure.png)

Confirm current unfinished-task condition follows the sequence below. The flow traces its enforcing steps to `L2-021` and includes rejection or recovery paths.

![Confirm current unfinished-task condition](diagrams/sequence-complete.png)

