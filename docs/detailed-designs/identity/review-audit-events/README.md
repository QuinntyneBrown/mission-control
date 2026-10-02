# Review security and mutation audit events

## Overview

Administrators review recorded security and data-changing operations without viewing secret or contact payloads.

- **Audit event** — immutable record of actor, operation, target, UTC timestamp, outcome, and correlation ID

Successful business audit entries agree with committed data. Denials and throttling remain inspectable even when no business mutation occurs.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.

| Part | Responsibility and architectural home |
| --- | --- |
| `AuditLogPage` | Routed page at `/audit` in `frontend/projects/mission-control`; composes `AuditEventView`, binds its `refresh` input to the page's own counter, and calls `inject(ApplicationShell).showStatus(AccessDenied)` when the view emits `forbidden`. The page opens no dialog, so no outcome changes that counter. |
| `AuditEventView` | Domain component in `frontend/projects/domain`; injects `AUDIT_EVENT_SERVICE`, owns its filter signal, the audit-event resource, and the actor-choice resource behind the Actor combobox, and takes `refresh: InputSignal<number>`, whose change rereads the events with the current filters. It renders the filter bar and the pager from presentational `components` controls (the actor combobox, selects, date inputs, and pagination) and emits `forbidden` when either read answers `403`. |
| `IAuditEventService`, `AUDIT_EVENT_SERVICE` | Interface and token in `frontend/projects/api/audit-event.service.contract.ts`; the consumer imports the contract only. |
| `AuditEventService` | Production HTTP adapter in `api`; `auditEventsResource(query)` and `actorChoicesResource(query)` each return a caller-owned signal resource and convert the HTTP call to signals. It holds no shared results. Composition binds a mock adapter for Chromium Playwright. |
| `AuditEventsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`. |
| `AuditEvent`, `AuditArea` | Domain entity, insert-only, and the enum of the area each event belongs to; the log reads events through the `AuditEventRow` projection. |
| `IMissionControlDataSession` | Shared Application data port defined in the [overview](../../README.md#data-access-and-security-ports); this slice reads through `ListAuditEventsAsync` and `ListAuditActorsAsync`, and mutation handlers write success audits through its `AddAuditEvent`. |
| `IAuditEventWriter`, `AuditEventWriter` | Application audit port and its Infrastructure adapter; `AppendRestrictedAsync(AuditEvent, ct)` inserts `Denied`, `Throttled`, and `Rejected` events outside any business transaction. |

Mutation handlers register each success audit with `AddAuditEvent` on the data session, and `SaveChangesAsync` commits it in the business transaction, so a rollback removes both.
Authentication, authorization, and protected-identity checks record denied, rejected (409 protected-identity), and throttled outcomes through `IAuditEventWriter.AppendRestrictedAsync`, which `AuditEventWriter` in Infrastructure implements.
That append runs outside any business transaction, so a rolled-back mutation never removes it, and it makes no successful-business claim.
`AuditOutcome` is `Succeeded`, `Rejected`, `Denied`, or `Throttled`; the audit-log outcome filter offers exactly these four.
Logs and audit records omit passwords, hashes, tokens, signing keys, connection strings, and contact payloads.
Optional actor ID remains null for unknown callers and for [startup seeding](../initialize-administrator/README.md); email is not substituted for identity.

`AuditLogPage` uses `/audit`, which requires the `audit.read` capability, and `AuditEventView` requests actor, area, outcome, and Toronto calendar-date filters combined with AND.
Each event stores its `AuditArea` (`SignIn`, `Accounts`, `Leads`, `Projects`, `WorkItems`, `Boards`, or `Sprints`), set by the operation that records it, and the Area filter offers exactly these seven; `ListAuditEventsQuery.area` filters on the stored value.
`CurrentAccountAuthorization` records `Denied` before dispatch, so no handler or loaded record supplies its details: it takes them from audit metadata that each controller action declares beside its capability policy, namely the area, the operation name, the entity type, and the route parameter that holds the entity ID.
The declared area follows the route: `/api/sessions` and `/api/session` declare `SignIn`; `/api/accounts…` and `/api/audit-events…` declare `Accounts`; `/api/home/lead-coverage` declares `Leads`, `/api/home/projects` declares `Projects`, and `/api/home/active-sprints` declares `Sprints`; every other route declares the area of its feature.
Work-item routes declare the entity type `WorkItem`, because the item is not read before a denial, so a denied story or task change shows "Work item" with the ID from the route.
These filter controls and Toronto time display come from the audit-log mock. SQL stores UTC; boundary conversion uses `America/Toronto` and half-open UTC intervals.
The Actor filter is a searchable combobox, the pattern of the project form's lead picker. Its choices come from `actorChoicesResource(query)`, which reads `ListAuditActorsQuery { search?, page, pageSize }`.
That query returns every account, inactive ones included, as ID and display name only, ordered by display name then ID, 25 per page by default and at most 100.
Typing debounces about 250 ms on the view's query signal, and the resource aborts a superseded search. "Anyone" is the cleared value: no actor ID is sent.
A failed actor search shows a field-level message under Actor with Retry, which calls `reload()` on the actor-choice resource, and the reference ID when a `500` carried one; a search that gets no response has none. The actor filter, the other filters, and the rows already shown stay, and the log can still be filtered and paged (`actor-failed` mock state).
Events without a known actor display Unknown and appear only while the filter is Anyone.
Each row shows the entity type with its ID shortened to the first eight characters; events without an entity ID name the attempt instead.
Invalid filters, an inverted date range, or a page size above 100 return `400`; the page keeps every filter and the rows already shown, marks the invalid filter, and shows its field message.
For an inverted range, To is marked invalid with "Choose a To date on or after" the From date (`invalid-range` mock state).
Records sort by timestamp descending then stable ID and default to 25 per page, capped at 100.
The page rows and the total matching count come from one statement with a window count, so they agree.
The view is read-only; no audit edit/delete endpoint exists. Production logs remain restricted operational data, separate from this administrative audit view.
Changing filters resets page one and announces the matching count; zero matches offer clear filters.
Filter and page changes are explicit actions, so each change of the query signal reads at once; the resource aborts the superseded read inside the adapter.
A failed event read shows the error state with Try again, and the reference ID when a `500` carried one.

A collaborator's request returns `403` and appends a `Denied` event; the capability summary then refreshes, `AuditEventView` emits `forbidden`, and `AuditLogPage` calls `inject(ApplicationShell).showStatus(AccessDenied)`, which replaces the page with the access-denied page.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Read and filter immutable audit events | `GET /api/audit-events` | `ListAuditEventsQuery` / `ListAuditEventsQueryHandler` |
| Search actor choices | `GET /api/audit-events/actors` | `ListAuditActorsQuery` / `ListAuditActorsQueryHandler` |

Mock input and review references:

- [Audit log · Mission Control mock](../../../mocks/admin/audit-log.html); review states: `default`, `actor-search`, `actor-failed`, `filtered-zero`, `invalid-range`, `loading`, `error`.
- [Status pages · Mission Control mock](../../../mocks/shell/status-pages.html); review states: `not-found`, `access-denied`, `error`, `offline`.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-029` | `L1-007` | Primary navigation must reach Home, Leads, and Projects, with account management visible only to administrators. Work details must expose their workspace and parent path. Direct routes must enforce authentication and handle missing records. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-043` | `L1-012` | The API must return a correlation ID for unexpected failures and write structured diagnostic records containing operation, UTC time, outcome, and that same ID. Users must receive useful error categories without internal stack traces or secret values. Production logs and diagnostics must be restricted operational data. |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Review security and mutation audit events: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Review security and mutation audit events: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, the insert-only audit writer, and the bounded audit read.

![Review security and mutation audit events: c4 component](diagrams/c4-component.png)

The class view shows the page's refresh binding and access-denied hand-off, the typed audit and actor queries with the stored area, where a `Denied` event's area, operation, and entity come from, the row projections, and the audit write and read ports.

![Review security and mutation audit events: class structure](diagrams/class-structure.png)

Read and filter immutable audit events and Search actor choices follow the sequence below. The flow traces its enforcing steps to `L2-039` and includes rejection or recovery paths, including a failed actor search and the access-denied hand-off.

![Read and filter immutable audit events](diagrams/sequence-read.png)

