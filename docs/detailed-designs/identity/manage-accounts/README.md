# Provision and manage accounts

## Overview

Administrators provision login accounts privately and manage their current access.

- **Designated administrator** — Quinntyne Brown account whose identity and highest capabilities remain protected
- **Credential version** — counter that invalidates tokens issued before a password replacement

Accounts remain separate from similarly named or emailed lead contacts. Deactivation preserves assignments and audit identity; account deletion is outside the baseline.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

All named production types are proposed; the repository currently contains requirements and static mocks.

| Part | Responsibility and architectural home |
| --- | --- |
| `AccountsPage` | Routed page or dialog owned by `frontend/projects/mission-control`; composes the domain library and presentational components. |
| `AccountView` | Domain component in `frontend/projects/domain`; injects `ACCOUNT_SERVICE` and holds feature state in signals. |
| `IAccountService`, `ACCOUNT_SERVICE` | Interface and token in `frontend/projects/api/account.service.contract.ts`; the consumer imports the contract only. |
| `AccountService` | Production HTTP adapter in `api`; owns HTTP calls and observable-to-signal conversion. Composition binds a mock adapter for Chromium Playwright. |
| `AccountsController` | Thin controller under `backend/src/MissionControl.Api/Controllers`, namespace `MissionControl.Api.Controllers`; binds, dispatches, and returns. |
| `UserAccount` | Domain entity or Application read projection described below; Domain has no external project dependency. |
| `IMissionControlDataSession` | Application data port; the Infrastructure adapter runs parameterized queries and transaction commits. |

Commands, queries, handlers, and request validators live in Application feature folders. Each type has its own file; folders and namespaces agree.
MediatR remains pinned to `12.5.0`. Microsoft.Extensions supplies dependency injection, Options, and Configuration.

`AccountsPage` and `AccountDetailPage` own routes `/accounts` and `/accounts/:id`.
`AccountFormDialog`, `AccountStatusDialog`, and `ReplacePasswordDialog` are application-owned dialogs.
The account service returns safe summaries, never hashes or replacement passwords. Account lists default to 25 rows with stable name/ID ordering.
New account names measure 1–100 characters; email measures at most 254 and normalizes for unique comparison.
Proposed passwords measure 12–128 characters without trimming. Role selection defaults to Collaborator in the mock.

`ProvisionAccountCommandValidator` checks fields; a SQL unique index protects normalized email under concurrent provisioning.
Account edits carry `expectedVersion`; SQL updates compare that version and increment it atomically.
The proposed design treats every existing account email as immutable, matching the account-form mock; L2 explicitly protects the designated email only.
The broader immutability rule remains a design proposal. Forged designated-email or demotion requests return `409`.
`DesignatedAdministratorPolicy` compares protected identity and rejects deactivation or loss of administrator access.
Administrator capability evaluation includes all capabilities, including later additions, rather than relying on a fixed seeded grant list.

Password replacement hashes the exact supplied value, increments `credentialVersion`, and commits both values with an audit event.
Replacing the caller's own password clears that session immediately after success. Other prior tokens fail on their next request.
Deactivation keeps the password and all assignments; only active accounts appear for new work assignments.
Reactivation restores login using the existing password and role. No public registration or account-delete endpoint exists.

The authenticated API evaluates current SQL permissions before feature dispatch. Validation V maps invalid fields to `400`, absent authentication to `401`, forbidden access to `403`, missing records to `404`, and conflicts to `409`.
Unexpected errors return a generic `500` with a correlation ID. Structured diagnostics exclude secrets and contact payloads.

Responsive profile R covers `320`, `375`, `576`, `768`, `992`, `1200`, and `1920` CSS-pixel widths at `800` pixels high.
Forms stack on compact screens; dialogs become sheets below `576px`. Templates, styles, and classes remain separate files.
Component styles read `var(--mc-<role>)` from the mirrored authoritative design-system tokens.
Keyboard actions include visible focus, named controls, modal focus containment, trigger focus restoration, and destination-heading focus after navigation.
Field errors connect to inputs; asynchronous results use status or alert announcements. Status text supplements color; primary touch targets measure at least `44×44` CSS pixels.

| Behavior | Proposed boundary | Request / handler |
| --- | --- | --- |
| Read account directory and details | `GET /api/accounts[/{id}]` | `GetAccountQuery` / `GetAccountQueryHandler` |
| Provision account | `POST /api/accounts` | `ProvisionAccountCommand` / `ProvisionAccountCommandHandler` |
| Edit names, role, or active status | `PUT /api/accounts/{id}; PUT /api/accounts/{id}/status` | `UpdateAccountCommand` / `UpdateAccountCommandHandler` |
| Replace account password | `PUT /api/accounts/{id}/password` | `ReplacePasswordCommand` / `ReplacePasswordCommandHandler` |

Mock input and review references:

- [Accounts · Mission Control mock](../../../mocks/admin/accounts.html); review states: `default`, `loading`, `error`.
- [Account details · Mission Control mock](../../../mocks/admin/account-detail.html); review states: `default`, `designated`, `inactive`, `not-found`, `loading`.
- [Add or edit account · Mission Control mock](../../../mocks/admin/account-form-dialog.html); review states: `create`, `validation`, `duplicate`, `saving`, `failed`, `created`, `edit`, `designated`, `conflict`.
- [Deactivate or reactivate account · Mission Control mock](../../../mocks/admin/account-status-dialog.html); review states: `deactivate`, `reactivate`, `blocked`, `saving`, `failed`.
- [Replace password · Mission Control mock](../../../mocks/admin/replace-password-dialog.html); review states: `default`, `own`, `validation`, `saving`, `failed`.

Implementation proceeds one behavior at a time using the linked Given-When-Then criteria. An API integration acceptance check first fails for the expected missing behavior.
A Chromium Playwright check uses one page object per screen and a mock service bound through the same token. Tests express intent; page objects own selectors.
The smallest implementation turns those checks green before the next behavior begins. Relevant regression checks follow each slice; no architecture tests are introduced.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-004` | `L1-001` | Administrators must provision active users, edit names and roles, set a replacement password, and deactivate/reactivate accounts. Users must have unique normalized email, first name, last name, and a role from profile P. Names must be 1–100 characters and email must be a syntactically valid address of at most 254 characters. Proposed password policy: new or replacement passwords must be 12–128 characters, without trimming. Account deletion is outside this baseline; deactivation preserves work assignments and audit identity. |
| `L2-005` | `L1-001` | The API and UI must apply permission profile P. Lead category or contact creation must not create a login or change a user's authorization. |
| `L2-008` | `L1-002` | Application operations must not delete, deactivate, demote, or change the email identity of the designated administrator. Its password can be replaced securely. |
| `L2-031` | `L1-008` | Forms must expose field-specific validation, retain input on rejected saves, prevent duplicate submission while pending, display results, and confirm leaving with unsaved edits. Destructive confirmations must name the affected item. |
| `L2-039` | `L1-010` | The system must record UTC timestamp, actor ID when known, operation, entity type/ ID, outcome, and correlation ID for account/permission changes, contact/workspace/ work mutations, board/sprint mutations, successful login, denied access, and throttling. Audit data must exclude secrets and contact payloads. Only administrators must access audit records; audit mutation endpoints must be absent. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-041` | `L1-011` | Edits must carry a record version or equivalent concurrency condition. SQL constraints must protect normalized account emails, lead email/category pairs, parent references, open sprint membership, and active sprint exclusivity. Caller errors must produce validation/conflict responses rather than generic failures. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Provision and manage accounts: c4 context](diagrams/c4-context.png)

The container view separates the client, .NET API, and durable SQL records.

![Provision and manage accounts: c4 container](diagrams/c4-container.png)

The component view locates request dispatch, domain behavior, and persistence within the feature.

![Provision and manage accounts: c4 component](diagrams/c4-component.png)

The class view shows proposed typed requests, interface consumption, and relationships between the feature parts.

![Provision and manage accounts: class structure](diagrams/class-structure.png)

Read account directory and details follows the sequence below. The flow traces its enforcing steps to `L2-004` and includes rejection or recovery paths.

![Read account directory and details](diagrams/sequence-read.png)

Provision account follows the sequence below. The flow traces its enforcing steps to `L2-004` and includes rejection or recovery paths.

![Provision account](diagrams/sequence-provision.png)

Edit names, role, or active status follows the sequence below. The flow traces its enforcing steps to `L2-004` and includes rejection or recovery paths.

![Edit names, role, or active status](diagrams/sequence-change-access.png)

Replace account password follows the sequence below. The flow traces its enforcing steps to `L2-004` and includes rejection or recovery paths.

![Replace account password](diagrams/sequence-replace-password.png)

