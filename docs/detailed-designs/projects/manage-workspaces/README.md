# Create and manage project workspaces

## Overview

A project workspace groups Toronto work under one delivery mode and an optional responsible lead.

- **Workspace** — project record that owns a work hierarchy, board order, and sprint records

Administrators manage workspace settings; collaborators read workspaces and contribute work. Empty workspace deletion never cascades through project data.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

All named production types are proposed; the repository currently contains requirements and static mocks.

| Part | Responsibility and architectural home |
| --- | --- |
| `ProjectListPage` | Routed page or dialog owned by `frontend/projects/mission-control`; composes the domain library and presentational components. |
| `WorkspaceView` | Domain component in `frontend/projects/domain`; injects `WORKSPACE_SERVICE` and holds feature state in signals. |
| `IWorkspaceService`, `WORKSPACE_SERVICE` | Interface and token in `frontend/projects/api/workspace.service.contract.ts`; the consumer imports the contract only. |
| `WorkspaceService` | Production HTTP adapter in `api`; owns HTTP calls and observable-to-signal conversion. Composition binds a mock adapter for Chromium Playwright. |
| `WorkspacesController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `Workspace` | Domain entity or Application read projection described below; Domain has no external project dependency. |
| `IMissionControlDataSession` | Application data port; the Infrastructure adapter runs parameterized queries and transaction commits. |

Commands, queries, handlers, and request validators live in Application feature folders. Each type has its own file; folders and namespaces agree.
MediatR remains pinned to `12.5.0`. Microsoft.Extensions supplies dependency injection, Options, and Configuration.

`ProjectListPage` owns `/projects`; `ProjectOverviewPage` owns `/projects/:id`.
`ProjectFormDialog` and `ProjectDeleteDialog` belong to the application project.
The list sorts by name then stable ID, 25 per page by default. Creating a workspace opens its overview with a saved confirmation.
Name measures 1–200 characters and description at most 10,000. Initial mode is Kanban or Scrum.
An optional responsible lead uses a paginated searchable combobox, matching the `lead-picker` mock.
The API rechecks the lead FK at save time; a lead removed after selection causes `400` without losing other input.

`UpdateWorkspaceCommand` excludes mode changes; the separate mode-change slice enforces active-sprint rules.
Create/edit/delete are administrator-only. Collaborators see an explanation rather than inaccessible create actions.
Workspace edits and deletes compare `expectedVersion`. Deletion checks every existing work item and sprint, including planned/active records.
Restrictive foreign keys prevent racing child creation and deletion. Any content returns `409`, with no cascade.
The mock mentions sprint history; treating every existing sprint as workspace content is a conservative proposed deletion rule.

The authenticated API evaluates current SQL permissions before feature dispatch. Validation V maps invalid fields to `400`, absent authentication to `401`, forbidden access to `403`, missing records to `404`, and conflicts to `409`.
Unexpected errors return a generic `500` with a correlation ID. Structured diagnostics exclude secrets and contact payloads.

Responsive profile R covers `320`, `375`, `576`, `768`, `992`, `1200`, and `1920` CSS-pixel widths at `800` pixels high.
Forms stack on compact screens; dialogs become sheets below `576px`. Templates, styles, and classes remain separate files.
Component styles read `var(--mc-<role>)` from the mirrored authoritative design-system tokens.
Keyboard actions include visible focus, named controls, modal focus containment, trigger focus restoration, and destination-heading focus after navigation.
Field errors connect to inputs; asynchronous results use status or alert announcements. Status text supplements color; primary touch targets measure at least `44×44` CSS pixels.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Read workspace list and overview | `GET /api/workspaces[/{id}]` | `GetWorkspaceQuery` / `GetWorkspaceQueryHandler` |
| Create workspace | `POST /api/workspaces` | `CreateWorkspaceCommand` / `CreateWorkspaceCommandHandler` |
| Edit workspace settings | `PUT /api/workspaces/{id}` | `UpdateWorkspaceCommand` / `UpdateWorkspaceCommandHandler` |
| Delete empty workspace | `DELETE /api/workspaces/{id}` | `DeleteWorkspaceCommand` / `DeleteWorkspaceCommandHandler` |

Mock input and review references:

- [Projects · Mission Control mock](../../../mocks/projects/project-list.html); review states: `default`, `collaborator`, `empty-admin`, `empty-collaborator`, `loading`, `error`.
- [Project overview · Mission Control mock](../../../mocks/projects/project-overview.html); review states: `default`, `kanban`, `new-empty`, `new-empty-collaborator`, `kanban-preserved`, `collaborator`, `not-found`, `loading`, `error`.
- [New or edit project · Mission Control mock](../../../mocks/projects/project-form-dialog.html); review states: `create`, `lead-picker`, `validation`, `lead-missing`, `saving`, `failed`, `edit`, `conflict`.
- [Delete project · Mission Control mock](../../../mocks/projects/project-delete-dialog.html); review states: `default`, `blocked`, `deleting`, `failed`.

Implementation proceeds one behavior at a time using the linked Given-When-Then criteria. An API integration acceptance check first fails for the expected missing behavior.
A Chromium Playwright check uses one page object per screen and a mock service bound through the same token. Tests express intent; page objects own selectors.
The smallest implementation turns those checks green before the next behavior begins. Relevant regression checks follow each slice; no architecture tests are introduced.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-005` | `L1-001` | The API and UI must apply permission profile P. Lead category or contact creation must not create a login or change a user's authorization. |
| `L2-014` | `L1-004` | Administrators must create, list, read, and edit workspaces with a required name (1–200 characters), optional description (up to 10,000 characters), delivery mode (Kanban or Scrum), and optional existing responsible lead contact. Workspace deletion must require confirmation and be blocked while work or sprint history exists. Initial mode selection is required; later changes follow L2-027. |
| `L2-031` | `L1-008` | Forms must expose field-specific validation, retain input on rejected saves, prevent duplicate submission while pending, display results, and confirm leaving with unsaved edits. Destructive confirmations must name the affected item. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Create and manage project workspaces: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Create and manage project workspaces: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Create and manage project workspaces: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Create and manage project workspaces: class structure](diagrams/class-structure.png)

Read workspace list and overview follows the sequence below. The flow traces its enforcing steps to `L2-014` and includes rejection or recovery paths.

![Read workspace list and overview](diagrams/sequence-read.png)

Create workspace follows the sequence below. The flow traces its enforcing steps to `L2-014` and includes rejection or recovery paths.

![Create workspace](diagrams/sequence-create.png)

Edit workspace settings follows the sequence below. The flow traces its enforcing steps to `L2-014` and includes rejection or recovery paths.

![Edit workspace settings](diagrams/sequence-edit.png)

Delete empty workspace follows the sequence below. The flow traces its enforcing steps to `L2-014` and includes rejection or recovery paths.

![Delete empty workspace](diagrams/sequence-delete.png)

