# View the Kanban story board

## Overview

Kanban shows continuous workspace delivery through three persisted statuses.

- **Board column** — To Do, In Progress, or Done group of ordered story cards

Each story appears once; tasks remain inside its detail view. Board placement is distinct from backlog priority.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

All named production types are proposed; the repository currently contains requirements and static mocks.

| Part | Responsibility and architectural home |
| --- | --- |
| `KanbanBoardPage` | Routed page or dialog owned by `frontend/projects/mission-control`; composes the domain library and presentational components. |
| `BoardView` | Domain component in `frontend/projects/domain`; injects `BOARD_SERVICE` and holds feature state in signals. |
| `IBoardService`, `BOARD_SERVICE` | Interface and token in `frontend/projects/api/board.service.contract.ts`; the consumer imports the contract only. |
| `BoardService` | Production HTTP adapter in `api`; owns HTTP calls and observable-to-signal conversion. Composition binds a mock adapter for Chromium Playwright. |
| `BoardsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `BoardCard` | Domain entity or Application read projection described below; Domain has no external project dependency. |
| `IMissionControlDataSession` | Application data port; the Infrastructure adapter runs parameterized queries and transaction commits. |

Commands, queries, handlers, and request validators live in Application feature folders. Each type has its own file; folders and namespaces agree.
MediatR remains pinned to `12.5.0`. Microsoft.Extensions supplies dependency injection, Options, and Configuration.

`KanbanBoardPage` owns `/projects/:id/board` when mode is Kanban and composes a `BoardView` domain component.
Presentational `StoryCard` receives title, status, assignee, task counts, and outputs actions; it imports no API contract or application service.
`GetKanbanBoardQueryHandler` reads story-only cards, with Unassigned text and saved per-column order.
Creating a story in either mode inserts its Kanban `BoardPlacement` at the bottom of To Do in the same transaction.
The workspace's Kanban `BoardState` is created with the workspace, so a mode switch needs no backfill.
Deletion removes the placement and compacts its column. Cards order by `(Status, Position)`, with story ID only as a tie-breaker.
Each column loads bounded batches, defaulting to 25 and capped at 100; its total count covers all matching stories.
Task count aggregation uses persisted child task statuses and does not multiply counts through joined membership tables.

At `992px` and wider all columns appear together. At `576–991px` the board scrolls within its own region.
Below `576px` a named column selector exposes one column at a time without page horizontal scrolling.
Empty columns remain represented, including a completely empty workspace; create actions reflect current permissions.
Opening a card routes to work details with ancestor context and bounded tasks. Project tabs remain pinned on phones; larger layouts pin header and tabs.
Scroll offsets include fixed-content clearance so keyboard focus remains visible. Failed batch loads preserve already loaded cards.
A missing workspace returns `404` and shows a not-found state linking back to Projects.
A read for a workspace now in Scrum mode returns `409`; the page re-reads the project and the Board tab shows the sprint board.
The `preserved` state keeps board operation available while stored Scrum plans remain paused.

The authenticated API evaluates current SQL permissions before feature dispatch. Validation V maps invalid fields to `400`, absent authentication to `401`, forbidden access to `403`, missing records to `404`, and conflicts to `409`.
Unexpected errors return a generic `500` with a correlation ID. Structured diagnostics exclude secrets and contact payloads.

Responsive profile R covers `320`, `375`, `576`, `768`, `992`, `1200`, and `1920` CSS-pixel widths at `800` pixels high.
Forms stack on compact screens; dialogs become sheets below `576px`. Templates, styles, and classes remain separate files.
Component styles read `var(--mc-<role>)` from the mirrored authoritative design-system tokens.
Keyboard actions include visible focus, named controls, modal focus containment, trigger focus restoration, and destination-heading focus after navigation.
Field errors connect to inputs; asynchronous results use status or alert announcements. Status text supplements color; primary touch targets measure at least `44×44` CSS pixels.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Read story columns and task counts | `GET /api/workspaces/{id}/board` | `GetKanbanBoardQuery` / `GetKanbanBoardQueryHandler` |

Mock input and review references:

- [Kanban board · Mission Control mock](../../../mocks/kanban/kanban-board.html); review states: `default`, `dragging`, `pending`, `move-failed`, `conflict`, `empty`, `empty-column`, `load-more`, `card-menu`, `collaborator`, `preserved`, `loading`, `error`.
- [Work item detail · Mission Control mock](../../../mocks/work/work-item-detail.html); review states: `default`, `initiative`, `epic`, `task`, `unset`, `inactive-assignee`, `collaborator`, `not-found`, `loading`, `error`.

Implementation proceeds one behavior at a time using the linked Given-When-Then criteria. An API integration acceptance check first fails for the expected missing behavior.
A Chromium Playwright check uses one page object per screen and a mock service bound through the same token. Tests express intent; page objects own selectors.
The smallest implementation turns those checks green before the next behavior begins. Relevant regression checks follow each slice; no architecture tests are introduced.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-019` | `L1-005` | A Kanban workspace must display To Do, In Progress, and Done columns with stories as cards. Each card must show title, assignee or Unassigned, and completed/total task counts. Opening a card must show its tasks and hierarchy path. Card ordering must be stable per column and independent of backlog priority. |
| `L2-030` | `L1-008` | Every login/session, account-management, lead CRUD, workspace, hierarchy, backlog, board, sprint, home, and navigation workflow must satisfy responsive profile R. Compact layouts must stack form fields and summary cards and provide local board scrolling or a column selector. Larger layouts must use available space without overlapping controls. Vertical page scrolling is permitted. |
| `L2-032` | `L1-008` | Production views must use the application design tokens and consistent typography, spacing, focus, form, and status patterns. Loading, empty data, zero search results, and request errors must be distinguishable and offer relevant actions. Visual review is for application UX; design artifacts themselves remain exempt from automated tests. |
| `L2-033` | `L1-009` | Every application workflow must be operable by keyboard without required dragging. Focus must remain visible, follow a logical sequence, and be managed when dialogs open/close and routed content changes. |
| `L2-034` | `L1-009` | Application controls must expose programmatic names and roles. Inputs must have associated labels; field errors must identify their inputs. Pages must expose main/navigation regions and a coherent heading hierarchy. Asynchronous outcomes must be announced without relying only on visual changes. |
| `L2-035` | `L1-009` | The application must meet the proposed WCAG 2.2 AA target. Normal text must reach 4.5:1 contrast, large text 3:1, and essential control boundaries/focus/status graphics 3:1 against adjacent colors. Status must include text or another non-color cue. Primary touch controls must provide at least 44×44 CSS-pixel targets; other controls must satisfy applicable AA target-size requirements. |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![View the Kanban story board: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![View the Kanban story board: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![View the Kanban story board: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![View the Kanban story board: class structure](diagrams/class-structure.png)

Read story columns and task counts follows the sequence below. The flow traces its enforcing steps to `L2-019` and includes rejection or recovery paths.

![Read story columns and task counts](diagrams/sequence-read.png)

