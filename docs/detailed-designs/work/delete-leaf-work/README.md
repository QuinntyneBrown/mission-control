# Delete permitted leaf work

## Overview

Administrators remove work only when doing so preserves its children and recorded delivery outcomes.

- **Leaf item** — work item with no children
- **Open sprint** — planned or active sprint whose live story membership blocks deletion

Named confirmation and non-cascading persistence prevent accidental loss of related work.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `WorkItemDetailPage`, `WorkHierarchyPage` | Routed pages in `frontend/projects/mission-control`, the `work/:itemId` and `work` child routes of `ProjectLayoutPage`; read `canDeleteWork` (the `work.delete` capability) from the layout and pass it to `WorkItemDetailView` and to `WorkHierarchyView`, which hands it to every `WorkHierarchyBranch`; open `WorkItemDeleteDialog` from their views' `actionRequested` output (Delete with the item's `WorkItemTarget`) and pass it the layout's `canChangeMode`; implement `FormDraft`: their routes keep `canDeactivate: UnsavedChangesGuard`, and their `draft` delegates to the open dialog, else falls back to the layout's open dialog (`inject(ProjectLayoutPage).draft()`), so leaving the project asks once. They react to `WorkItemDeleteOutcome` as listed below, increment their `refresh` counter at once on the `unconfirmed` output of the delete dialog or of the `SprintScopeDialog` they open for `RemoveFromSprint`, and show the "Your access changed" toast through `TOAST_SERVICE`, without Retry, on that `SprintScopeDialog`'s `forbidden` output. |
| `WorkItemDeleteDialog` | Application confirmation dialog hosting `WorkItemDeleteForm`; implements `FormDraft` from its `draftChange` (never dirty; pending while the deletion runs) and closes through `close(result: WorkItemDeleteOutcome?)`: `Deleted` on the form's `deleted`, `AlreadyDeleted` on `alreadyDeleted`, `RemoveFromSprint(sprintId)` on `removeFromSprintRequested`, `ChangePlan(sprintId)` on `changePlanRequested`, `ChangeMode` on `changeModeRequested`, and no result on Cancel, Close, or Escape. It relays the form's `unconfirmed` as its own output and stays open. |
| `WorkItemDeleteForm` | Domain component in `frontend/projects/domain`; injects `WORK_ITEM_SERVICE`; takes the item's `WorkItemTarget` and `canChangeMode`; owns the pending, blocker, forbidden, and failure state of one deletion; emits `deleted`, `alreadyDeleted`, `unconfirmed`, `removeFromSprintRequested(sprintId)`, `changePlanRequested(sprintId)`, or `changeModeRequested` when the person chooses a remedy, and `draftChange`. |
| `IWorkItemService`, `WORK_ITEM_SERVICE` | Contract and token in `frontend/projects/api/work-item.service.contract.ts`; read members return a caller-owned `ResourceRef<T>`, mutation members a `Promise<TResult>`. |
| `WorkItemService` | HTTP adapter in `api`; creates each resource in the consumer's injection context, converts observables to signals or promises, aborts a superseded read when the query signal changes, and cancels reads on consumer destroy; no shared mutable state. |
| `WorkItemsController` | Thin controller in `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `WorkItem` | Domain entity; `checkDeletion(childCount, openSprint, openSprintStatus, sprintsPaused)` returns the `DeletionBlocker` that stops a deletion, or none for a leaf outside open sprint membership. |
| `DeletionBlocker` | Domain value naming every blocker found: the child count and, for a story, the open sprint, its state, the story's status, and whether sprints are paused; the API returns it as the `409` body. |
| `IMissionControlDataSession` | Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this slice uses `BeginWorkspaceTransactionAsync`, `LoadDeletionCheckAsync`, `RemoveWorkItem`, `AddAuditEvent`, and `SaveChangesAsync`. |

`WorkItemDeleteOutcome` lists what the opening page reacts to when the dialog closes:

- **`Deleted`.** The page increments its `refresh` counter and shows the "Task deleted" toast, named for the item's type, through `TOAST_SERVICE`; `WorkItemDetailPage` first opens the parent's detail, or the work outline for an initiative.
- **`AlreadyDeleted`.** The same reread and navigation, with the toast saying the item was already deleted. After the dialog relayed `unconfirmed`, that first deletion may be the one that went through, so the page instead shows the neutral info toast "“Publish team list for mentors” has been deleted.", naming the item.
- **`RemoveFromSprint(sprintId)`.** The page opens `SprintScopeDialog` in remove mode with `removeStoryId`, the target's `scopeSummary`, and `offerSprintsLink` true. On its `SprintScopeOutcome` `Changed(ScopeChangeSummary)` the page increments its counter and shows the "Scope updated" toast with the outcome's summary through `TOAST_SERVICE`; on `Outdated` it increments its counter; no result changes nothing. While that dialog stays open, its `forbidden` output (an unexpected `403`) makes the page show the "Your access changed" toast through `TOAST_SERVICE`, without Retry.
- **`ChangePlan(sprintId)`.** The page navigates to `/projects/:id/sprints/:sprintId/plan?remove={storyId}`.
- **`ChangeMode`.** The page calls `inject(ProjectLayoutPage).openDialog(ChangeMode)`, which opens `ModeChangeDialog`.

Closing with no result changes nothing, and focus returns to the Delete action.
`WorkItemDeleteDialog` names the item and initially focuses Cancel. It explains child and open-sprint blockers.
A blocker explanation replaces the confirmation inside the dialog's alert region and becomes the dialog's description; Delete gives way to Close, so focus moves to Close.
The dialog reads nothing when it opens: it names the item from the opening view's `WorkItemTarget` (type, key, title, and parent title), sends no version, and the handler re-checks every rule.
`DeleteWorkItemCommand` carries only the workspace and item IDs; a deletion carries no expected version.
`DeleteWorkItemCommandHandler` first calls `BeginWorkspaceTransactionAsync`, which takes the workspace lock, then checks children and current open sprint membership before deleting anything.
`LoadDeletionCheckAsync` reads the item, its child count, its open sprint membership with the sprint's state, its parent, and the tracked sibling order, backlog order, and boards it would leave.
`WorkItem.checkDeletion` decides inside that transaction, and a blocked deletion returns one `409` whose `DeletionBlocker` names every blocker found: the child count and, for a story, the open sprint, its state, the story's status, and `sprintsPaused` when the workspace uses Kanban with kept sprints. The form explains each blocker and offers no retry:

- **Children.** Move or delete them first; Close only (`has-children` mock state).
- **Planned sprint.** "Change Sprint N's plan" emits `changePlanRequested(sprintId)`; the dialog closes with `ChangePlan(sprintId)`, and the opening page navigates to `/projects/:id/sprints/:sprintId/plan?remove={storyId}`, which opens the plan with the story marked To remove once the plan's member read confirms it is still a member (`in-planned-sprint`).
- **Planned sprint while sprints are paused.** A Kanban workspace keeps its sprint plans but can't change them, so `sprintsPaused` is true. The dialog explains the pause ("Switch the project back to Scrum to change its plan, then delete the story.") and offers Close; with `canChangeMode` it also offers Change delivery mode, which emits `changeModeRequested`; the dialog closes with `ChangeMode`, and the opening page calls `inject(ProjectLayoutPage).openDialog(ChangeMode)`, which opens `ModeChangeDialog` (`in-paused-sprint`). Close returns to the page that opened the dialog.
- **Active sprint, unfinished story.** "Remove from Sprint N" emits `removeFromSprintRequested(sprintId)`; the dialog closes with `RemoveFromSprint(sprintId)`, and the opening page opens `SprintScopeDialog` in remove mode with `removeStoryId` and a `ScopeStorySummary` (key, title, status, assignee, task counts, estimate) taken from the target's `scopeSummary` (`in-sprint`).
- **Active sprint, Done story.** A Done story can't leave an active sprint's scope; the dialog explains that the story can be deleted once the sprint closes and its outcome is recorded, and offers Close only (`in-sprint-done`).

A missing item returns `404`; the form emits `alreadyDeleted`, and the dialog closes with `AlreadyDeleted`.
A `500`, or a lock-wait timeout's `503` with `Retry-After`, deletes nothing; the dialog shows the reference ID, focus stays on Try again, and only an explicit Try again resends (`failed` mock state).
A deletion that gets no response may have committed, so the dialog never says nothing was deleted: the `failed` alert reads "We couldn't confirm whether the task was deleted", without a reference ID, and the form emits `unconfirmed`, which the dialog relays, so the opening page rereads at once.
Try again sends again only when pressed; if the first deletion went through, it returns `404` and closes the dialog with `AlreadyDeleted`, and the page, which received the relayed `unconfirmed`, shows the neutral info toast "“Publish team list for mentors” has been deleted." instead of saying it was already deleted.
Restrictive self-references and open-membership FKs protect races with child creation and sprint allocation.
Only a leaf outside open membership is deleted. `RemoveWorkItem` removes the item; its sibling position goes as a tracked child of the loaded sibling order, and the remaining siblings are compacted in the same transaction.
Deleting a story also removes its board placements and story backlog position as tracked children of the loaded boards and backlog order and compacts both orders in that transaction; every affected order version increments.
Deleting a task increments its parent story's task revision in the same transaction, and only that: the story's version and every sprint's version stay unchanged ([Confirm story completion](../../kanban/confirm-story-completion/README.md#description)). `AddAuditEvent` registers the success audit, and `SaveChangesAsync` commits it with the deletion.
After the `204` the dialog closes with `Deleted`: the outline rereads its expanded branches and their counts, and focus moves to the parent's row; the detail page opens the parent's detail, or the work outline for an initiative.
Closed `SprintStoryOutcome` rows keep independent recorded IDs/titles/statuses without a cascading FK to live work.
Every story confirmation says that closed sprints that included it keep its recorded title and outcome; the dialog doesn't look up which (`history`).
Later live deletion leaves snapshots intact; the history view suppresses missing destination/story links.
Collaborators lack `work.delete`, so the pages pass `canDeleteWork` false and Delete shows as unavailable with a written reason; direct requests receive `403`. Cancellation sends no deletion.
If the role changes while the dialog is open, Delete returns `403`: the dialog stays open with "Only administrators can delete work" in its alert, no reference ID, and Delete unavailable, and focus moves to Cancel (the `failed` mock state's note).
The interceptor's capability refresh after that `403` turns the layout's `canDeleteWork` false, so the page's Delete actions become unavailable too.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Delete a confirmed leaf item | `DELETE /api/workspaces/{id}/work-items/{itemId}` | `DeleteWorkItemCommand` / `DeleteWorkItemCommandHandler` |

Mock input and review references:

- [Delete work item · Mission Control mock](../../../mocks/work/work-item-delete-dialog.html); review states: `default`, `has-children`, `in-planned-sprint`, `in-paused-sprint`, `in-sprint`, `in-sprint-done`, `history`, `deleting`, `failed`.
- [Work item detail · Mission Control mock](../../../mocks/work/work-item-detail.html); review states: `default`, `status-failed`, `initiative`, `epic`, `task`, `unset`, `inactive-assignee`, `collaborator`, `not-found`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-018` | `L1-004` | Only administrators must delete work, after confirmation naming the item. Deletion must be blocked while children exist or a story belongs to a planned or active sprint. Closed sprint history must survive a later permitted deletion. |
| `L2-027` | `L1-006` | Only administrators must switch workspace mode. An active sprint must block a mode change. Kanban mode must preserve planned/closed sprints but disable their execution until returning to Scrum; work remains available on the Kanban board. |
| `L2-031` | `L1-008` | Forms must expose field-specific validation, retain input on rejected saves, prevent duplicate submission while pending, display results, and confirm leaving with unsaved edits. Destructive confirmations must name the affected item. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Delete permitted leaf work: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Delete permitted leaf work: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Delete permitted leaf work: c4 component](diagrams/c4-component.png)

The class view shows the confirmation dialog and its domain form, the typed command, and the data-session members this feature uses.

![Delete permitted leaf work: class structure](diagrams/class-structure.png)

Delete a confirmed leaf item follows the sequence below. The flow traces its enforcing steps to `L2-018` and includes rejection or recovery paths.

![Delete a confirmed leaf item](diagrams/sequence-delete.png)

