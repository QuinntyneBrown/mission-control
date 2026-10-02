# Delete an unreferenced lead contact

## Overview

Administrators remove obsolete lead contacts after reviewing a named confirmation.

- **Responsible contact** — existing lead referenced as the owner of a project workspace

A contact still responsible for a workspace remains protected from deletion. Removing a permitted contact preserves accounts, work, and sprint history.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `LeadDetailPage` | Routed page for `/leads/:id` in `frontend/projects/mission-control`; passes `canManageLeads` (`leads.manage`) to `LeadDetailView`, whose Delete appears only when it is true and whose `deleteRequested` output opens `LeadDeleteDialog` with the loaded details. It injects `TOAST_SERVICE` and reacts to the dialog's `LeadDeleteOutcome`: `Deleted` navigates to `/leads`, which reads afresh, and shows the "Lead deleted" toast naming the lead; `AlreadyDeleted` navigates the same way and shows an info toast saying the lead was already deleted, or, when the dialog relayed `unconfirmed` before it closed, an info toast that neutrally says the named lead has been deleted ("Hana Kim has been deleted."); no result changes nothing. While the dialog stays open, its `unconfirmed` output makes the page increment its view's `refresh` at once, so the details reread. |
| `LeadDirectoryPage` | Routed directory page in `frontend/projects/mission-control`; passes `canManageLeads` to `LeadDirectoryView`, so rows offer Delete only with `leads.manage`, and opens `LeadDeleteDialog` with the row from the view's `deleteRequested` output. It injects `TOAST_SERVICE` and reacts to `LeadDeleteOutcome`: `Deleted` increments its view's `refresh` and shows the "Lead deleted" toast naming the lead; `AlreadyDeleted` increments `refresh` and shows the already-deleted info toast, or the neutral "Hana Kim has been deleted." info toast when the dialog relayed `unconfirmed` before it closed; the dialog's `unconfirmed` increments `refresh` at once while the dialog stays open. Both pages name the lead from the target they opened the dialog with. |
| `LeadDeleteDialog` | Application dialog in `frontend/projects/mission-control`; hosts `LeadDeleteForm`, names the contact, offers Cancel, and implements `FormDraft` from the form's latest `DraftState`. It closes through `close(result: LeadDeleteOutcome?)`: `Deleted` on the form's `deleted` output, `AlreadyDeleted` on `alreadyDeleted`, and no result on Cancel or Escape or once a navigation completes that deactivates the lead page hosting it, such as one of the blocked explanation's project links; it relays the form's `unconfirmed` as its own output and stays open. Both opening pages implement `FormDraft` by delegating to their open dialog, as [Create and edit lead contacts](../maintain-contacts/README.md) describes. |
| `LeadDeleteForm` | Domain component in `frontend/projects/domain`; injects `LEAD_SERVICE`, owns the pending, blocked, and failure state of one deletion in signals, and emits `deleted`, `alreadyDeleted`, `unconfirmed` when the delete gets no response, and `draftChange` (never dirty; pending while the delete is in flight). |
| `ILeadService`, `LEAD_SERVICE` | Contract and token in `frontend/projects/api/lead.service.contract.ts`; the mutation `delete(command)` returns a `Promise<void>`. Consumers import the contract only. |
| `LeadService` | Production HTTP adapter in `api`; converts the observable to the promise inside `api` and holds no shared mutable state. |
| `LeadsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`. |
| `LeadContact` | Domain entity; `checkDeletion` rejects a contact that any workspace names responsible. |
| `LeadReferencedProblem` | Application `409` ProblemDetails carrying the responsible-workspace count and a bounded preview. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this slice uses its typed reads, `RemoveLead`, `AddAuditEvent`, and `SaveChangesAsync`. |

`LeadDeleteDialog` names the contact and initially focuses Cancel. Cancellation sends no mutation request.
When the dialog opens on the blocked explanation, or switches to it after a `409`, focus moves to Close and the explanation is announced as an alert.
`LeadDeleteForm` receives the target as an input: the directory row, or the loaded details with their responsible count and preview.
The target's `isCityLead`, which both the row and the details carry, selects the City contact copy (`city-lead`): the title names Quinntyne Brown's City contact, and the text says that the administrator account, password, and permissions don't change.
When the loaded lead details already report a nonzero `responsibleWorkspaceCount`, the form opens on the blocked explanation from that data without a request.
`DeleteLeadCommand` carries only the lead ID; deletion carries no expected version.
`DeleteLeadCommandHandler` reads the lead, the count of workspaces naming it responsible, and the first 10 of them by name then ID before it deletes anything.
Lead deletion changes no workspace, so it takes no workspace lock.
A missing lead returns `404`. The form emits `alreadyDeleted`, and the dialog closes with `AlreadyDeleted`.
`LeadDirectoryPage` increments its view's `refresh`, so the directory reloads without the lead; `LeadDetailPage` navigates to the directory, which reads afresh. Either page then shows an info toast through `TOAST_SERVICE` saying that the named lead was already deleted, unless the dialog relayed `unconfirmed` before it closed (see below).
A `403`, after the role changed while the dialog was open, keeps the dialog open, explains that only administrators can delete leads, and leaves Delete lead unavailable, so focus moves to that alert; nothing is deleted and no reference ID appears. A `500` keeps Delete lead focused and announces the failure with its reference ID.
A deletion that gets no response may have committed, so the dialog never says nothing was deleted: the `failed` alert reads "We couldn't confirm whether Hana Kim was deleted", without a reference ID, and the form emits `unconfirmed`, which the dialog relays, so the opening page rereads at once.
Delete lead sends again only when pressed; if the first deletion went through, it returns `404` and the dialog closes with `AlreadyDeleted`.
That deletion may have been the first request, so the opening page, which received the relayed `unconfirmed`, shows the neutral info toast "Hana Kim has been deleted." instead of saying the lead was already deleted.
A referenced contact returns `409`. `LeadReferencedProblem` carries `responsibleWorkspaceCount` and at most 10 `workspaces` with reassignment guidance, never the full set; each is a `ResponsibleWorkspace` (ID, name, mode), the type lead details also return.
The blocked explanation shows the count, links each listed project and offers Open project for it, and adds a "View all projects led by" link naming the lead.
That link opens `/projects?responsibleLeadId={leadId}`, the project list filtered to this lead, so every blocking workspace is reachable.
The client builds the route from the lead ID it already holds; the problem carries no client URL.
These project links, Open project, and View all projects led by are router links inside the dialog: the route's `UnsavedChangesGuard` lets them pass, because the delete form is never dirty, and the dialog closes with no result once the navigation completes, which deactivates the lead page hosting it, so nothing is deleted and the opening page changes nothing. A query-only Back or Forward on the directory reuses `LeadDirectoryPage` and leaves the dialog open.
A directory-row delete shows the same blocked explanation after that `409`, with no delete or retry action.
A restrictive workspace foreign key prevents a racing ownership assignment from creating a dangling contact reference.
That rejection rolls back the delete and its audit; the handler re-reads the count and preview and returns the same `409`.
Successful deletion removes only that lead row through `RemoveLead` and registers its success `AuditEvent` (actor, operation, lead ID, outcome, and correlation ID, never contact values) through `AddAuditEvent`; `SaveChangesAsync` commits both in one transaction. `CurrentAccountAuthorization` audits a refused `403` as `Denied`. The form emits `deleted`, and the dialog closes with `Deleted`.
`LeadDirectoryPage` increments its view's `refresh` input, so the directory reloads its resource with live counts; `LeadDetailPage` navigates to the directory, which reads afresh. Either page shows the "Lead deleted" success toast naming the lead through `TOAST_SERVICE` (`deleted` directory state). Focus returns to a surviving directory control or heading.
Account identity and closed history have no cascading contact dependency.
Deleting Quinntyne Brown's City contact follows the same path (`city-lead`): it removes that contact row alone, and the administrator account's identity, password, status, and permissions stay unchanged.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Confirm and delete a lead | `DELETE /api/leads/{id}` | `DeleteLeadCommand` / `DeleteLeadCommandHandler` |

Mock input and review references:

- [Delete lead · Mission Control mock](../../../mocks/leads/lead-delete-dialog.html); review states: `default`, `city-lead`, `blocked`, `deleting`, `failed`.
- [Lead directory · Mission Control mock](../../../mocks/leads/lead-directory.html); review states: `default`, `collaborator`, `category`, `filtered`, `zero-results`, `page-2`, `filter-invalid`, `deleted`, `empty-admin`, `empty-collaborator`, `loading`, `error`.
- [Lead details · Mission Control mock](../../../mocks/leads/lead-detail.html); review states: `default`, `lead`, `lead-rafael`, `lead-lucia`, `saved`, `collaborator`, `not-found`, `loading`, `error`.
- [Projects · Mission Control mock](../../../mocks/projects/project-list.html); review states: `default`, `collaborator`, `many`, `by-lead`, `by-lead-rafael`, `by-lead-lucia`, `lead-filter-invalid`, `empty-admin`, `empty-collaborator`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-005` | `L1-001` | The API and UI must apply permission profile P. Lead category or contact creation must not create a login or change a user's authorization. |
| `L2-012` | `L1-003` | Lead deletion must require confirmation naming the contact and must be blocked while any workspace references the lead as its responsible contact. |
| `L2-013` | `L1-003` | Initial seeding must create a separate City contact for Quinntyne Brown at the designated email with no phone supplied. Existing matching City contacts must not be duplicated or have later contact edits reset by startup. |
| `L2-031` | `L1-008` | Forms must expose field-specific validation, retain input on rejected saves, prevent duplicate submission while pending, display results, and confirm leaving with unsaved edits. Destructive confirmations must name the affected item. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Delete an unreferenced lead contact: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Delete an unreferenced lead contact: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Delete an unreferenced lead contact: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Delete an unreferenced lead contact: class structure](diagrams/class-structure.png)

Confirm and delete a lead follows the sequence below. The flow traces its enforcing steps to `L2-012` and includes rejection or recovery paths.

![Confirm and delete a lead](diagrams/sequence-delete.png)

