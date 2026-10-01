# Create and edit lead contacts

## Overview

FaithTech Toronto records team lead responsibilities in a contact directory.

- **Lead contact** — person record with one Create, Communication, City, Prayer, or Event category

This slice creates and edits contacts without changing login accounts. Multiple contacts share a category, and one email may appear in different categories.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

All named production types are proposed; the repository currently contains requirements and static mocks.

| Part | Responsibility and architectural home |
| --- | --- |
| `LeadDirectoryPage` | Routed page or dialog owned by `frontend/projects/mission-control`; composes the domain library and presentational components. |
| `LeadFormDialog` | Application dialog in `frontend/projects/mission-control`, opened from Add lead or Edit on the directory or lead details; composes `LeadView`. |
| `LeadView` | Domain component in `frontend/projects/domain`; injects `LEAD_SERVICE` and holds feature state in signals. |
| `ILeadService`, `LEAD_SERVICE` | Interface and token in `frontend/projects/api/lead.service.contract.ts`; the consumer imports the contract only. |
| `LeadService` | Production HTTP adapter in `api`; owns HTTP calls and observable-to-signal conversion. Composition binds a mock adapter for Chromium Playwright. |
| `LeadsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `LeadContact` | Domain entity or Application read projection described below; Domain has no external project dependency. |
| `IMissionControlDataSession` | Application data port; the Infrastructure adapter runs parameterized queries and transaction commits. |

Commands, queries, handlers, and request validators live in Application feature folders. Each type has its own file; folders and namespaces agree.
MediatR remains pinned to `12.5.0`. Microsoft.Extensions supplies dependency injection, Options, and Configuration.

`LeadFormDialog` opens from Add lead or Edit and moves focus to First name.
`CreateLeadCommandValidator` and `UpdateLeadCommandValidator` trim required text and check 1–100-character names, valid email up to 254 characters, and the category enum.
Phone is optional and at most 32 characters. International prefixes, spaces, parentheses, and hyphens remain as typed; no local phone format is imposed.
SQL uniquely indexes `(NormalizedEmail, Category)`. Contact writes do not join or mutate account identity tables.

Edits include `expectedVersion`. `UpdateLeadCommandHandler` checks existence, version, and the email/category pair before it writes.
On a stale-version `409` the form keeps the attempted values and reads the latest version once (no resubmission); Reload latest adopts the latest values and version while the comparison stays visible.
The conflict copy names no person or time; the comparison lists "Your edit" beside "Latest saved".
A duplicate email/category returns `409` with the existing contact's ID, name, and category, so the form can name and link that lead.
The form keeps every value and flags email and category; selecting a different category can resolve it.
A racing insert or update that the unique index rejects receives the same duplicate `409`.
A missing or deleted contact returns `404`; the form disables its fields and Save and offers Back to leads.
Canceled forms leave persisted data unchanged. Pending saves disable repeat submission; failed saves keep valid input and offer explicit retry.

The authenticated API evaluates current SQL permissions before feature dispatch. Validation V maps invalid fields to `400`, absent authentication to `401`, forbidden access to `403`, missing records to `404`, and conflicts to `409`.
Unexpected errors return a generic `500` with a correlation ID. Structured diagnostics exclude secrets and contact payloads.

Responsive profile R covers `320`, `375`, `576`, `768`, `992`, `1200`, and `1920` CSS-pixel widths at `800` pixels high.
Forms stack on compact screens; dialogs become sheets below `576px`. Templates, styles, and classes remain separate files.
Component styles read `var(--mc-<role>)` from the mirrored authoritative design-system tokens.
Keyboard actions include visible focus, named controls, modal focus containment, trigger focus restoration, and destination-heading focus after navigation.
Field errors connect to inputs; asynchronous results use status or alert announcements. Status text supplements color; primary touch targets measure at least `44×44` CSS pixels.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Create a lead | `POST /api/leads` | `CreateLeadCommand` / `CreateLeadCommandHandler` |
| Edit a lead | `PUT /api/leads/{id}` | `UpdateLeadCommand` / `UpdateLeadCommandHandler` |

Mock input and review references:

- [Add or edit lead · Mission Control mock](../../../mocks/leads/lead-form-dialog.html); review states: `add`, `add-international`, `validation`, `saving`, `failed`, `duplicate`, `edit`, `conflict`, `conflict-reloaded`, `deleted`.
- [Lead details · Mission Control mock](../../../mocks/leads/lead-detail.html); review states: `default`, `lead`, `saved`, `collaborator`, `not-found`, `loading`, `error`.

Implementation proceeds one behavior at a time using the linked Given-When-Then criteria. An API integration acceptance check first fails for the expected missing behavior.
A Chromium Playwright check uses one page object per screen and a mock service bound through the same token. Tests express intent; page objects own selectors.
The smallest implementation turns those checks green before the next behavior begins. Relevant regression checks follow each slice; no architecture tests are introduced.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-005` | `L1-001` | The API and UI must apply permission profile P. Lead category or contact creation must not create a login or change a user's authorization. |
| `L2-009` | `L1-003` | Lead records must include first name and last name (1–100 characters each), email (1–254 characters with a syntactically valid address), optional phone (at most 32 characters), and one category: Create, Communication, City, Prayer, or Event. Phone must accept international prefixes and ordinary spaces, parentheses, and hyphens; no phone number can be fabricated. Duplicate normalized email/category pairs are prohibited; the same email in different categories is allowed. |
| `L2-011` | `L1-003` | Administrators must edit all contact fields and category using L2-009 validation and concurrency protection from L2-041. |
| `L2-031` | `L1-008` | Forms must expose field-specific validation, retain input on rejected saves, prevent duplicate submission while pending, display results, and confirm leaving with unsaved edits. Destructive confirmations must name the affected item. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Create and edit lead contacts: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Create and edit lead contacts: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Create and edit lead contacts: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Create and edit lead contacts: class structure](diagrams/class-structure.png)

Create a lead follows the sequence below. The flow traces its enforcing steps to `L2-009` and includes rejection or recovery paths.

![Create a lead](diagrams/sequence-create.png)

Edit a lead follows the sequence below. The flow traces its enforcing steps to `L2-011` and includes rejection or recovery paths.

![Edit a lead](diagrams/sequence-edit.png)

