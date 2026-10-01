# Close a sprint and resolve unfinished work

## Overview

Sprint closure records completed outcomes and explicitly relocates every unfinished story.

- **Disposition** — decision to return an unfinished story to backlog or move it to an eligible planned sprint
- **Closure snapshot** — immutable record of sprint fields, scope, and story outcomes at closure

Closure commits the entire decision or leaves the sprint and memberships unchanged.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

All named production types are proposed; the repository currently contains requirements and static mocks.

| Part | Responsibility and architectural home |
| --- | --- |
| `SprintBoardPage` | Routed page or dialog owned by `frontend/projects/mission-control`; composes the domain library and presentational components. |
| `SprintView` | Domain component in `frontend/projects/domain`; injects `SPRINT_SERVICE` and holds feature state in signals. |
| `ISprintService`, `SPRINT_SERVICE` | Interface and token in `frontend/projects/api/sprint.service.contract.ts`; the consumer imports the contract only. |
| `SprintService` | Production HTTP adapter in `api`; owns HTTP calls and observable-to-signal conversion. Composition binds a mock adapter for Chromium Playwright. |
| `SprintsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `Sprint` | Domain entity or Application read projection described below; Domain has no external project dependency. |
| `IMissionControlDataSession` | Application data port; the Infrastructure adapter runs parameterized queries and transaction commits. |

Commands, queries, handlers, and request validators live in Application feature folders. Each type has its own file; folders and namespaces agree.
MediatR remains pinned to `12.5.0`. Microsoft.Extensions supplies dependency injection, Options, and Configuration.

`CloseSprintDialog` lists every unfinished story with a destination and supports Set all.
No planned destination leaves backlog as the available choice. A sprint with only Done stories closes without carryover choices.
`CloseSprintCommandValidator` returns `400` identifying each unresolved story and invalid target.
The request carries expected sprint version and one disposition per unfinished story in the reviewed scope.

`CloseSprintCommandHandler` locks the workspace, source sprint, selected planned destinations, and affected stories.
The shared workspace transaction/version protocol serializes board/task changes, scope changes, start, mode change, and closure.
Every membership and relevant story/task mutation increments active sprint revision, so stale closure review receives `409`.
The handler validates that each destination is Planned and in this workspace and that no exclusive-membership constraint is violated.
It captures name, goal, planned dates, actual start/close, initial/final scope, scope log, and each story ID/title/status/destination.
Snapshot rows carry recorded destination names/IDs independently of live FKs, preserving later missing destinations.

Done stories leave live open membership and remain associated through immutable outcomes.
Unfinished stories remove source membership and optionally add target planned membership with unchanged status, IDs, parents, and tasks.
The sprint becomes Closed, releases the active slot, and commits outcomes, carryover, ordering/board cleanup, and success audit together.
Any failure rolls back the whole change. The UI retains disposition choices; a scope conflict reloads for review without resubmitting.
Success opens sprint history and the board shows No active sprint.

The authenticated API evaluates current SQL permissions before feature dispatch. Validation V maps invalid fields to `400`, absent authentication to `401`, forbidden access to `403`, missing records to `404`, and conflicts to `409`.
Unexpected errors return a generic `500` with a correlation ID. Structured diagnostics exclude secrets and contact payloads.

Responsive profile R covers `320`, `375`, `576`, `768`, `992`, `1200`, and `1920` CSS-pixel widths at `800` pixels high.
Forms stack on compact screens; dialogs become sheets below `576px`. Templates, styles, and classes remain separate files.
Component styles read `var(--mc-<role>)` from the mirrored authoritative design-system tokens.
Keyboard actions include visible focus, named controls, modal focus containment, trigger focus restoration, and destination-heading focus after navigation.
Field errors connect to inputs; asynchronous results use status or alert announcements. Status text supplements color; primary touch targets measure at least `44×44` CSS pixels.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Close with a disposition for every unfinished story | `POST /api/workspaces/{id}/sprints/{sprintId}/close` | `CloseSprintCommand` / `CloseSprintCommandHandler` |

Mock input and review references:

- [Close sprint · Mission Control mock](../../../mocks/scrum/close-sprint-dialog.html); review states: `default`, `unresolved`, `all-done`, `no-planned`, `conflict`, `closing`, `failed`.
- [Sprint history · Mission Control mock](../../../mocks/scrum/sprint-history.html); review states: `default`, `renamed`, `not-found`, `loading`, `error`.
- [Sprint board · Mission Control mock](../../../mocks/scrum/sprint-board.html); review states: `default`, `scope-log`, `no-stories`, `no-active`, `move-failed`, `collaborator`, `loading`, `error`.

Implementation proceeds one behavior at a time using the linked Given-When-Then criteria. An API integration acceptance check first fails for the expected missing behavior.
A Chromium Playwright check uses one page object per screen and a mock service bound through the same token. Tests express intent; page objects own selectors.
The smallest implementation turns those checks green before the next behavior begins. Relevant regression checks follow each slice; no architecture tests are introduced.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-025` | `L1-006` | Closing an active sprint must require a disposition for every unfinished story: return to backlog or move to an eligible planned sprint in the same workspace. Closure must be atomic, record a close instant and story outcomes, and preserve completed stories' association with the closed sprint. |
| `L2-026` | `L1-006` | Closed sprint history must preserve its name, goal, planned dates, actual start/ close instants, initial and final scope, and story IDs, titles, statuses, and carryover destinations as recorded at closure. Later edits, reparenting, or permitted deletions must not rewrite these recorded outcomes. |
| `L2-031` | `L1-008` | Forms must expose field-specific validation, retain input on rejected saves, prevent duplicate submission while pending, display results, and confirm leaving with unsaved edits. Destructive confirmations must name the affected item. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Close a sprint and resolve unfinished work: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Close a sprint and resolve unfinished work: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Close a sprint and resolve unfinished work: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Close a sprint and resolve unfinished work: class structure](diagrams/class-structure.png)

Close with a disposition for every unfinished story follows the sequence below. The flow traces its enforcing steps to `L2-025` and includes rejection or recovery paths.

![Close with a disposition for every unfinished story](diagrams/sequence-close.png)

