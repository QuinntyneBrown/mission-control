# Prioritize siblings and the story backlog

## Overview

Authorized users organize related work and decide which stories take priority next.

- **Sibling order** — order of items sharing a parent and hierarchy level
- **Backlog priority** — workspace-wide story order independent of epic membership
- **Column order** — board-card order independent of both sibling order and backlog priority

This slice changes the first two orders while preserving stable IDs.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

All named production types are proposed; the repository currently contains requirements and static mocks.

| Part | Responsibility and architectural home |
| --- | --- |
| `BacklogPage` | Routed page or dialog owned by `frontend/projects/mission-control`; composes the domain library and presentational components. |
| `WorkOrderView` | Domain component in `frontend/projects/domain`; injects `WORK_ORDER_SERVICE` and holds feature state in signals. |
| `IWorkOrderService`, `WORK_ORDER_SERVICE` | Interface and token in `frontend/projects/api/work-order.service.contract.ts`; the consumer imports the contract only. |
| `WorkOrderService` | Production HTTP adapter in `api`; owns HTTP calls and observable-to-signal conversion. Composition binds a mock adapter for Chromium Playwright. |
| `WorkOrdersController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `WorkOrder` | Domain entity or Application read projection described below; Domain has no external project dependency. |
| `IMissionControlDataSession` | Application data port; the Infrastructure adapter runs parameterized queries and transaction commits. |

Commands, queries, handlers, and request validators live in Application feature folders. Each type has its own file; folders and namespaces agree.
MediatR remains pinned to `12.5.0`. Microsoft.Extensions supplies dependency injection, Options, and Configuration.

`BacklogPage` owns `/projects/:id/backlog`; hierarchy actions share `MovePositionDialog`.
Each story has a `StoryBacklogPosition` row independent of its WorkItem sibling position and board placement.
Backlog pages default to 25, ordered by priority then ID. New stories append; deletion removes their live ordering rows.
Move up/down, pointer dragging, and absolute Move to position all dispatch typed move commands.
Absolute positions refer to the full ordered set, so an item can move to a position on an unloaded page.
The API validates the destination against the persisted set rather than the visible page.

`ReorderSiblingCommandHandler` and `PrioritizeStoryCommandHandler` lock the workspace order row and compare `expectedOrderVersion`.
The simple design rewrites only the affected contiguous position interval in one transaction.
Unique keys protect `(WorkspaceId, ParentId, Type, SiblingPosition)` and `(WorkspaceId, BacklogPosition)`.
The SQL adapter uses temporary positions or equivalent provider-safe deferred ordering during interval updates; the provider-specific strategy is `<TO SUPPLY>`.
The aggregate order version increments after reorder, insert, delete, or reparent; stale moves return `409`.
Cross-workspace IDs and invalid positions return `400`. Failed optimistic moves restore the last saved order and retain focus; conflicts require reload before another move.

Kanban backlog omits sprint actions; preserved sprint memberships remain readable in paused Kanban mode.
In Scrum, Add to sprint delegates to sprint planning or explicit active-scope change; Done and already-allocated stories show eligibility reasons.
Ordering itself does not alter parent links, story status, or any sprint membership.

The authenticated API evaluates current SQL permissions before feature dispatch. Validation V maps invalid fields to `400`, absent authentication to `401`, forbidden access to `403`, missing records to `404`, and conflicts to `409`.
Unexpected errors return a generic `500` with a correlation ID. Structured diagnostics exclude secrets and contact payloads.

Responsive profile R covers `320`, `375`, `576`, `768`, `992`, `1200`, and `1920` CSS-pixel widths at `800` pixels high.
Forms stack on compact screens; dialogs become sheets below `576px`. Templates, styles, and classes remain separate files.
Component styles read `var(--mc-<role>)` from the mirrored authoritative design-system tokens.
Keyboard actions include visible focus, named controls, modal focus containment, trigger focus restoration, and destination-heading focus after navigation.
Field errors connect to inputs; asynchronous results use status or alert announcements. Status text supplements color; primary touch targets measure at least `44×44` CSS pixels.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Reorder siblings | `PUT /api/workspaces/{id}/work-order/siblings` | `ReorderSiblingCommand` / `ReorderSiblingCommandHandler` |
| Prioritize a story across epics | `PUT /api/workspaces/{id}/work-order/backlog` | `PrioritizeStoryCommand` / `PrioritizeStoryCommandHandler` |
| Read bounded backlog and full priority count | `GET /api/workspaces/{id}/backlog` | `ListBacklogQuery` / `ListBacklogQueryHandler` |

Mock input and review references:

- [Backlog · Mission Control mock](../../../mocks/backlog/backlog.html); review states: `default`, `add-to-sprint`, `kanban`, `kanban-preserved`, `collaborator`, `empty`, `reorder-failed`, `loading`, `error`.
- [Move to position · Mission Control mock](../../../mocks/work/move-position-dialog.html); review states: `default`, `backlog`, `out-of-range`, `failed`.
- [Work hierarchy · Mission Control mock](../../../mocks/work/work-hierarchy.html); review states: `default`, `move-menu`, `collaborator`, `empty`, `large`, `batch-error`, `loading`, `error`.

Implementation proceeds one behavior at a time using the linked Given-When-Then criteria. An API integration acceptance check first fails for the expected missing behavior.
A Chromium Playwright check uses one page object per screen and a mock service bound through the same token. Tests express intent; page objects own selectors.
The smallest implementation turns those checks green before the next behavior begins. Relevant regression checks follow each slice; no architecture tests are introduced.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-017` | `L1-004` | Permitted users must reorder siblings at each hierarchy level and prioritize a workspace's story backlog independently of sibling ordering. Reordering must preserve stable item IDs and persist a deterministic order without duplicates. |
| `L2-020` | `L1-005` | Permitted users must move stories between statuses and reorder cards using both pointer dragging and labeled move controls. The API must apply status and column order atomically. Failed or conflicting moves must restore the last saved view. |
| `L2-033` | `L1-009` | Every application workflow must be operable by keyboard without required dragging. Focus must remain visible, follow a logical sequence, and be managed when dialogs open/close and routed content changes. |
| `L2-034` | `L1-009` | Application controls must expose programmatic names and roles. Inputs must have associated labels; field errors must identify their inputs. Pages must expose main/navigation regions and a coherent heading hierarchy. Asynchronous outcomes must be announced without relying only on visual changes. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Prioritize siblings and the story backlog: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Prioritize siblings and the story backlog: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Prioritize siblings and the story backlog: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Prioritize siblings and the story backlog: class structure](diagrams/class-structure.png)

Reorder siblings follows the sequence below. The flow traces its enforcing steps to `L2-017` and includes rejection or recovery paths.

![Reorder siblings](diagrams/sequence-siblings.png)

Prioritize a story across epics follows the sequence below. The flow traces its enforcing steps to `L2-017` and includes rejection or recovery paths.

![Prioritize a story across epics](diagrams/sequence-backlog.png)

Read bounded backlog and full priority count follows the sequence below. The flow traces its enforcing steps to `L2-017` and includes rejection or recovery paths.

![Read bounded backlog and full priority count](diagrams/sequence-read.png)

