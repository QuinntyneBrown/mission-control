# Find and read lead contacts

## Overview

The directory helps authorized users find leads by responsibility and contact information.

- **Directory result** — bounded ordered contact page plus total matching count

Contact details identify the City Lead and show absent phone values explicitly. Lead responsibilities never imply application permissions.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `LeadDirectoryPage` | Routed page for `/leads` in `frontend/projects/mission-control`; keeps search, category, and page in the route query, reads `currentSession` through `SESSION_SERVICE`, computes `canManageLeads` from the `leads.manage` capability, passes the filters, that flag, and its own `refresh` counter to `LeadDirectoryView`, and opens `LeadFormDialog` and `LeadDeleteDialog` from the view's `createRequested`, `editRequested`, and `deleteRequested` outputs; [Create and edit lead contacts](../maintain-contacts/README.md) and [Delete an unreferenced lead contact](../delete-contact/README.md) define its reaction to each close result. |
| `LeadDetailPage` | Routed page for `/leads/:id` in `frontend/projects/mission-control`; reads `currentSession` through `SESSION_SERVICE`, composes `LeadDetailView` with `canManageLeads` (`leads.manage`) and its own `refresh` counter, and opens `LeadFormDialog` and `LeadDeleteDialog` from the view's `editRequested` and `deleteRequested` outputs, reacting to their close results as those pages define. |
| `LeadDirectoryView` | Domain component in `frontend/projects/domain`; injects `LEAD_SERVICE`, owns a `leadsResource` driven by its debounced query signal, and renders rows, chips, paging, and the directory states. Its `canManageLeads` input shows Add lead and each row's Edit and Delete, or hides them and renders the reason: only administrators can add, edit, or delete leads. |
| `LeadDetailView` | Domain component in `frontend/projects/domain`; injects `LEAD_SERVICE`, owns a `leadResource` for the routed lead, and renders the details, not-found, and load-error states. Its `canManageLeads` input shows Edit and Delete, or hides them and renders the same reason. |
| `ILeadService`, `LEAD_SERVICE` | Contract and token in `frontend/projects/api/lead.service.contract.ts`; the read members `leadsResource(query)` and `leadResource(query)` return caller-owned `ResourceRef<LeadDirectoryResult>` and `ResourceRef<LeadDetailResult>`. Consumers import the contract only. |
| `LeadService` | Production HTTP adapter in `api`; creates each resource in the consumer's injection context, converts observables to signals or promises, aborts a superseded read when the query signal changes, and cancels reads on consumer destroy; no shared mutable state. |
| `LeadsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`. |
| `LeadContact` | Domain entity read through the projections below. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this slice uses only its typed read queries. |

`GET /api/leads` applies trimmed case-insensitive substring search to first name, last name, combined full name, email, and phone.
Category and search combine with AND before counting or paging. Literal wildcard characters are escaped for SQL substring matching; parameters remain data.
The stable order is last name, first name, then ID. Pages default to 25 and cap at 100; invalid sizes return `400`.
An unknown category or a page below 1 in the route query returns the same `400` with a field message, for example from an outdated or edited link.
`LeadDirectoryView` then shows `filter-invalid`: the message with Clear filter, which opens the full directory at page 1, and no Try again or reference ID, because nothing failed on the server.
That state shows no rows, paging, or chip counts, since the response carried none.
`ListLeadsQuery` results carry the page, the total matching count, and five zero-filled `categoryTotals` over all persisted leads, each a `CategoryCount` (category and count), the type home coverage also uses.
Search and category never change `categoryTotals`, so category chip counts stay stable while filtering. Loading and error states show no counts.
`ListLeadsQueryHandler` reads the page rows, total matching count, and category totals in one snapshot-isolation read transaction, so the three agree.
The provider-specific isolation setting is chosen at the SQL gate. Rows carry only directory columns; no per-row query runs.

Search/filter state uses route query parameters so home category links preserve context: home's Prayer card opens `/leads?category=prayer` with the Prayer chip pressed and only Prayer leads, whose total matches home's Prayer count (`category` mock state). A search or category change resets page one.
Browser Back or Forward between two directory queries changes only the route query, so `LeadDirectoryPage` stays active and runs no `canDeactivate`: an open lead dialog stays open with its draft while the view reads the restored query.
`LeadDirectoryView` emits `filtersChanged` as the person types or chooses, and `LeadDirectoryPage` writes the route query, which returns as the view's `filters` input.
The view's query signal applies the shared search rule: typed search reaches it once the text has been stable for about `250` ms, while category, page, and Clear filter change it at once.
`leadsResource` reads each new query, and `LeadService` aborts the superseded HTTP request inside the adapter, so a late response never replaces newer rows.
After a committed create, edit, or delete, `LeadDirectoryPage` increments the view's `refresh` input, and the view reloads its resource.
A loaded result is announced in the status region, including zero results such as "No Event leads found". Zero results offer Clear filter.

`LeadDetailPage` owns `/leads/:id`; `LeadDetailView` reads the lead through `leadResource` and displays saved values, explicit Not provided phone text, and City Lead identity.
After a committed edit the page increments the view's `refresh` input, and the view reloads its resource.
`GetLeadQuery` also returns `responsibleWorkspaceCount` and `responsibleWorkspaces`: at most 10 workspaces (ID, name, mode) naming the lead responsible, ordered by name then ID.
The lead row, the count, and that preview come from one snapshot read, so the card never contradicts itself.
The Responsible for card shows the count and the preview. Whenever the count is at least 1, the card adds a "View all projects led by" link naming the lead (`lead`, `lead-rafael`, and `lead-lucia` mock states).
That link opens `/projects?responsibleLeadId={leadId}`, the project list filtered through `ListWorkspacesQuery.responsibleLeadId`, so every responsible workspace stays reachable.
A zero count reads as no project responsibility and shows no link.
A nonexistent lead ID returns `404`, and so does a malformed one, which matches no API route under the `{id:guid}` route constraint; malformed identifiers in a query string or request body return `400` instead.
On a `404` the resource reports the error and the view shows "Lead not found" with Back to leads.
Other read failures show the load-error state with Try again, which calls `reload()`; a `500` adds its reference ID, and a read that gets no response shows none while the shell's offline banner appears.
A contact is labeled City Lead when its category is City and its normalized email equals the configured designated email (`InitializationOptions`); the unique email/category index guarantees at most one.
Read projections expose `isCityLead`; the label never reflects any account's role. It uses the City category styling, not a role or permission badge.
Email/phone links open local `mailto:` / `tel:` clients; Mission Control sends no messages.
Links to other routes, such as a lead's details, a responsible project, View all projects led by, and Back to leads, are router links the views render from IDs in their results. Actions that open a dialog and filter or page changes leave a view through outputs, which its page maps to the dialog or the route query.
Below `768px` directory rows become labeled cards. Initial loading skeletons differ from empty data, zero results, and request errors.
Collaborators retain read access. Without `leads.manage` the pages pass `canManageLeads` as false, so contact mutation controls are absent and the views explain why; the API still answers `403`.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Search and filter the directory | `GET /api/leads` | `ListLeadsQuery` / `ListLeadsQueryHandler` |
| Read lead details | `GET /api/leads/{id}` | `GetLeadQuery` / `GetLeadQueryHandler` |

Mock input and review references:

- [Lead directory · Mission Control mock](../../../mocks/leads/lead-directory.html); review states: `default`, `collaborator`, `category`, `filtered`, `zero-results`, `page-2`, `filter-invalid`, `deleted`, `empty-admin`, `empty-collaborator`, `loading`, `error`.
- [Lead details · Mission Control mock](../../../mocks/leads/lead-detail.html); review states: `default`, `lead`, `lead-rafael`, `lead-lucia`, `saved`, `collaborator`, `not-found`, `loading`, `error`.
- [Projects · Mission Control mock](../../../mocks/projects/project-list.html); review states: `default`, `collaborator`, `many`, `by-lead`, `by-lead-rafael`, `by-lead-lucia`, `lead-filter-invalid`, `empty-admin`, `empty-collaborator`, `loading`, `error`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-005` | `L1-001` | The API and UI must apply permission profile P. Lead category or contact creation must not create a login or change a user's authorization. |
| `L2-010` | `L1-003` | The directory must show names, category, email, and phone with a readable empty phone value and link to lead details. Search must use a trimmed, case-insensitive substring of first name, last name, combined full name, email, or phone; category filter and search must combine using AND. Default ordering is last name, first name, then stable ID. Pagination follows L2-045. |
| `L2-013` | `L1-003` | Initial seeding must create a separate City contact for Quinntyne Brown at the designated email with no phone supplied. Existing matching City contacts must not be duplicated or have later contact edits reset by startup. |
| `L2-029` | `L1-007` | Primary navigation must reach Home, Leads, and Projects, with account management visible only to administrators. Work details must expose their workspace and parent path. Direct routes must enforce authentication and handle missing records. |
| `L2-030` | `L1-008` | Every login/session, account-management, lead CRUD, workspace, hierarchy, backlog, board, sprint, home, and navigation workflow must satisfy responsive profile R. Compact layouts must stack form fields and summary cards and provide local board scrolling or a column selector. Larger layouts must use available space without overlapping controls. Vertical page scrolling is permitted. |
| `L2-032` | `L1-008` | Production views must use the application design tokens and consistent typography, spacing, focus, form, and status patterns. Loading, empty data, zero search results, and request errors must be distinguishable and offer relevant actions. Visual review is for application UX; design artifacts themselves remain exempt from automated tests. |
| `L2-034` | `L1-009` | Application controls must expose programmatic names and roles. Inputs must have associated labels; field errors must identify their inputs. Pages must expose main/navigation regions and a coherent heading hierarchy. Asynchronous outcomes must be announced without relying only on visual changes. |
| `L2-037` | `L1-010` | The backend must independently enforce validation V, permission profile P, and record relationship rules. Data access must treat user text as data, and Angular must render user text without executing markup or scripts. CORS must permit only configured frontend origins. Public registration must not be exposed. |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Find and read lead contacts: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Find and read lead contacts: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Find and read lead contacts: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Find and read lead contacts: class structure](diagrams/class-structure.png)

Search and filter the directory follows the sequence below. The flow traces its enforcing steps to `L2-010` and includes rejection or recovery paths.

![Search and filter the directory](diagrams/sequence-search.png)

Read lead details follows the sequence below. The flow traces its enforcing steps to `L2-010` and includes rejection or recovery paths.

![Read lead details](diagrams/sequence-read.png)

