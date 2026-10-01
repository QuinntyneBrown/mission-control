# Mission Control — Product Requirements Document

**Status:** Initial product baseline; proposed defaults are identified below.  
**Date:** September 30, 2026  
**Product owner:** Quinntyne Brown, FaithTech Toronto City Lead  
**Stack:** .NET backend, Angular frontend, SQL database

## 1. Purpose and context

Mission Control is a full-stack application for coordinating FaithTech Toronto's
leadership team and project delivery. It must give the City Lead and authorized
collaborators one pleasant workspace to maintain lead contact details, organize
work, and follow progress from an initiative down to its tasks.

FaithTech describes itself as a global Christian technology community organized
around city communities and volunteer teams building technology together.
[FaithTech's website](https://www.faithtech.com/) provides organizational context;
the Toronto scope and product requirements come from the product owner's brief.
The supplied [owner profile](https://www.linkedin.com/in/quinntynebrown) is a
reference, not an application integration or a source of imported personal data.

## 2. Goals and launch outcomes

- Make lead contact information easy to create, find, update, and remove.
- Support both continuous Kanban work and timeboxed Scrum delivery.
- Preserve a clear Initiative → Epic → Story → Task hierarchy.
- Provide application-owned authentication and authorization backed by SQL.
- Ensure the designated administrator exists with the highest capabilities.
- Deliver a polished, accessible experience across extra small through extra
  large screens, with generous white space and clear navigation.

Launch is successful when an administrator can sign in, manage all five lead
categories, organize a complete work hierarchy, and deliver work through both
Kanban and Scrum. The same workflows must pass acceptance checks on mobile and
desktop. No implementation is implied by this document.

## 3. Users, permissions, and terminology

The City Lead is the primary user. Authorized collaborators are a proposed
additional audience for planning and updating work.

**Team lead categories:** Create, Communication, City, Prayer, and Event.
"Create" is a leadership category as well as the name of a CRUD action.
"City (Me)" means the City Lead is Quinntyne Brown. These categories identify
leadership responsibilities; they do not themselves grant application permissions.

**Proposed authorization baseline:**

| Capability | Administrator | Collaborator |
| --- | --- | --- |
| Read lead contacts and project work | Yes | Yes |
| Create, edit, and delete lead records | Yes | No |
| Create and update work; operate boards and sprints | Yes | Yes |
| Delete work, change project mode, or configure boards | Yes | No |
| Provision accounts, assign roles, or deactivate users | Yes | No |

All access requires authentication. Authorization must be enforced by the backend
for every operation. Hiding controls in Angular is an additional UX measure.
An administrator is the highest-capability role and includes every application
permission. A lead contact can exist without a login account.

## 4. Scope

### Initial release

- Login, logout, SQL-backed accounts and roles, JWT issuance and validation.
- An idempotent administrator seed and administrative account provisioning.
- Team lead CRUD, contact details, category filtering, and search.
- Project workspaces with a Kanban or Scrum mode.
- Initiative, epic, story, and task CRUD with parent-child navigation.
- Backlog ordering, assignment, statuses, Kanban boards, and Scrum sprints.
- A home workspace showing lead category coverage and project progress.
- Responsive navigation, accessible interactions, and useful feedback states.

### Deferred scope

External identity providers, public registration, email/SMS sending, event
registration, prayer-request records, donations, third-party project-management
integrations, multi-city tenancy, and native mobile apps are outside the initial
release. Communication, Prayer, and Event refer to lead categories in this scope;
separate modules for those activities require additional requirements.

## 5. Functional requirements

### FR-01 — Application-owned accounts and authentication

The .NET application must persist users, password hashes, account status, and
authorization assignments in SQL. It must authenticate credentials and issue
signed, expiring JWT access tokens. SQL remains the authority for account access.
The initial release must provide login, logout, and administrator-managed accounts.
Passwords, signing keys, and tokens must never appear in logs or API responses.

**Acceptance criteria:**

1. Given an active user with valid credentials, when they sign in, then the API
   returns a signed access token with an expiry and the UI opens the workspace.
2. Given invalid credentials, when login is submitted, then the UI displays a
   generic authentication error without revealing whether the email exists.
3. Given a missing, expired, tampered, wrong-issuer, or wrong-audience token, when
   a protected endpoint is requested, then the API returns an unauthorized result.
4. Given an authenticated user without the required permission, when they attempt
   a restricted operation directly through the API, then access is forbidden and
   no data changes.
5. Given a user has been deactivated or lost a permission, when their existing
   token is used, then the next protected request reflects the current SQL access.
6. Given a signed-in user, when they log out, then the client clears its session
   and protected routes require login. Local logout does not promise revocation
   of an already issued token; that token expires or is denied by account access.

### FR-02 — Persistent seeded administrator

The application must ensure the following administrator exists after database
initialization and every completed startup seed:

| Field | Required bootstrap value |
| --- | --- |
| First name | Quinntyne |
| Last name | Brown |
| Email | quinntynebrown@gmail.com |
| Initial password | `MissionCtrl2026!` |
| Role | Administrator, with the highest available capabilities |

These are user-specified bootstrap values. Store only a password hash in SQL;
provide the initial password through deployment configuration rather than
duplicating it as a production-code constant. Re-running the seed must preserve
an existing password, including one changed after initialization.

**Acceptance criteria:**

1. Given an empty initialized database, when seeding completes, then exactly one
   account with this normalized email exists, has the specified name and highest
   permissions, and can sign in with the bootstrap password.
2. Given the administrator already exists, when seeding runs again or two instances
   seed concurrently, then no duplicate account is created and its password is
   preserved.
3. Given the account exists with reduced capabilities, when seeding completes,
   then its administrator capabilities and active status are restored.
4. Given an administrator attempts to delete, deactivate, or demote the designated
   seeded account, when the operation is submitted, then it is rejected with a
   clear explanation that the designated administrator must remain available.
5. Given database initialization or seeding fails, when the app starts, then it
   reports a startup/readiness failure without exposing credentials or reporting
   a successful initialization.

### FR-03 — Team lead management

Authorized users must be able to create, list, read, update, and delete team lead
records. Each record must capture first name, last name, phone number, email, and
one of the five lead categories. Multiple contacts per category are a proposed
default. First name, last name, category, and email are required; phone is optional
until supplied. Display Quinntyne Brown as the City Lead without inventing a phone
number; the initial City contact is a proposed seed separate from the login user.

**Acceptance criteria:**

1. Given an administrator enters valid contact details and a category, when the
   record is saved, then it appears in the directory and persists after reload.
2. Given a missing required field or malformed email, when save is attempted,
   then inline errors identify the fields and no invalid record is persisted.
3. Given an existing lead, when an authorized user updates their contact details
   or category, then the saved details appear in the directory and detail view.
4. Given directory records, when a user searches by name or email or filters by
   category, then matching records appear and a zero-result state is explicit.
5. Given a user cancels deletion, when the confirmation closes, then the record
   remains; given confirmation, then the record is removed from the directory.
6. Given a lead is linked to active project ownership, when deletion is attempted,
   then deletion is blocked until ownership is reassigned or removed. Deleting a
   contact must not delete a login account or project work.

### FR-04 — Workspaces and work hierarchy

Each project workspace must have a name, description, and selected delivery mode.
Users with permission must manage Initiative → Epic → Story → Task records.
Every record must have an identifier, title, description, status, ordering, and
optional assignee. Each epic belongs to one initiative, each story to one epic,
and each task to one story, all inside the same workspace. Initiatives are roots.
An assignee is an active application user; a workspace can separately identify a
responsible lead contact. Dates and story estimates are proposed optional fields.

**Acceptance criteria:**

1. Given a workspace, when a user creates an initiative, epic, story, and task
   with valid parent links, then the complete hierarchy persists and is navigable.
2. Given a wrong-type parent, a cross-workspace parent, or a missing required
   parent, when a child is saved, then validation rejects the operation.
3. Given an existing record, when a user changes its details, status, order, or
   assignee, then all views show the saved result after reload.
4. Given a parent with children, when deletion is requested, then deletion is
   blocked until children are moved or removed; no silent cascade deletes occur.
5. Given a leaf record, when an authorized user confirms deletion, then it is
   removed and aggregate counts update.
6. Given concurrent edits to the same record, when an outdated version is saved,
   then the application identifies the conflict and offers reload without silently
   overwriting the newer change.

### FR-05 — Kanban delivery

A Kanban workspace must provide an ordered backlog and a board with at least
To Do, In Progress, and Done. Stories are board cards; tasks are managed inside
their story. Status changes must work through pointer interaction and an
accessible move/status control. Work-in-progress limits are a proposed optional
setting and must be advisory unless enforcement is explicitly selected later.

**Acceptance criteria:**

1. Given a Kanban workspace with stories, when its board opens, then each story
   appears once in the column corresponding to its status.
2. Given a movable card, when the user moves it or selects a new status, then the
   status and ordering persist after reload and the card appears in its new column.
3. Given the API rejects a move, when the operation fails, then the UI restores
   the last saved position and provides a useful retry message.
4. Given a user cannot drag a card, when they use keyboard or touch status controls,
   then they can complete the same move and receive confirmation.
5. Given unfinished tasks inside a story, when marking the story Done is requested,
   then the app requires task completion or explicit confirmation and shows the
   remaining task count.

### FR-06 — Scrum delivery

A Scrum workspace must provide an ordered backlog, story selection into planned
sprints, a sprint goal, start/end dates, an active sprint board, and sprint closure.
The board uses the same story statuses as Kanban. At most one sprint per workspace
can be active; a story can belong to at most one planned or active sprint at a time.
Tasks follow their story's sprint. Completed sprint history must remain readable.

**Acceptance criteria:**

1. Given a Scrum workspace, when a user creates a sprint with valid dates and a
   goal and selects backlog stories, then the sprint plan persists.
2. Given end precedes start, a story is already in another open sprint, or another
   sprint is active, when the conflicting action is submitted, then it is rejected.
3. Given a valid planned sprint, when a user starts it, then it becomes active and
   its board contains its selected stories and their current statuses.
4. Given an active sprint with unfinished stories, when closing it, then the user
   must choose to return unfinished stories to the backlog or move them to a planned
   sprint; completed stories remain associated with the closed sprint.
5. Given closed sprints, when history is opened, then users can read their goals,
   dates, and recorded completion outcomes, including unfinished work at closure.
6. Given a workspace with an active sprint, when a mode change is requested, then
   it is blocked until the sprint closes. A permitted mode change preserves the
   work hierarchy, statuses, ordering, and sprint history.

### FR-07 — Home workspace and navigation

The initial home screen must surface the five lead categories, available project
workspaces, work counts by status, and active sprints. Primary navigation must make
leads and projects easy to reach; hierarchy views must provide parent context.

**Acceptance criteria:**

1. Given a signed-in user, when the home screen opens, then authorized summaries
   reflect persisted data and link to the corresponding directory or project view.
2. Given a new workspace with no records, when it opens, then the empty state
   explains the next permitted action and provides a relevant creation control.
3. Given loading or a failed request, when a screen renders, then it shows a clear
   loading state or an actionable error with retry, without appearing empty.

## 6. UI, accessibility, and responsive requirements

**UX-01:** Use a coherent design system with authoritative tokens for typography,
color, spacing, radius, and focus states. Establish clear hierarchy, restrained
visual density, generous white space, consistent forms, and legible status cues.

**UX-02:** Every user-facing workflow above must work at XS (<576px), small
(576–767px), medium (768–991px), large (992–1199px), and XL (≥1200px). Validate at
320, 375, 576, 768, 992, 1200, and 1920 CSS pixels. Forms and navigation collapse
appropriately; boards can scroll within their own region. The page itself must
not require horizontal scrolling at these widths.

**UX-03:** Meet WCAG 2.2 AA as a proposed accessibility target. Provide semantic
controls, labels, visible focus, keyboard navigation, contrast, non-color status
indicators, and touch-friendly targets. Manage focus in dialogs and announce save
results and validation errors to assistive technology.

**UX-04:** Preserve valid form input after a failed save, prevent duplicate submits,
show submission progress, and warn before abandoning unsaved changes. Destructive
actions require clear confirmation naming the affected item.

**Acceptance criteria:** Given each login, lead CRUD, hierarchy CRUD, board,
sprint, and administrative account workflow, when it is exercised at every listed
viewport and using keyboard navigation, then all essential actions are reachable,
text and controls remain legible, and the workflow completes without lost data or
clipped controls. Given a failed form save, when the error appears, then valid
input remains and the user can correct or retry it.

## 7. Security, reliability, and performance

- **NFR-01 — Security:** Use TLS in deployment, secure password hashing, external
  secret configuration, parameterized SQL access, validated inputs, restricted
  CORS, and rate limiting on login. Proposed baseline: after five failed attempts
  for an account in 15 minutes, further attempts are throttled for 15 minutes.
  Successful login, denied access, and throttling must be behaviorally testable.
- **NFR-02 — Data protection:** Protect contact details and restrict directory
  access to authenticated authorized users. Do not log passwords, JWTs, or contact
  payloads. Audit records must identify actor, operation, entity ID, timestamp, and
  outcome for account/permission changes and create/update/delete actions.
- **NFR-03 — Persistence:** Committed changes must survive application restart.
  Related writes must be transactional, and database constraints must protect
  unique user emails and valid hierarchy links. Proposed email deduplication for
  leads is per category, allowing one person to hold different responsibilities.
- **NFR-04 — Operations:** Provide health/readiness checks, structured error logs
  and correlation IDs, repeatable database migrations, and a documented backup and
  restore procedure. A restore rehearsal must recover users, contacts, hierarchy,
  boards, and sprint history before release.
- **NFR-05 — Performance:** Proposed initial test budget: 1,000 contacts, 10,000
  work items across 50 workspaces, and 25 concurrent users. Paginate directories
  and backlogs. Under that fixture, p95 API reads and writes must finish within
  500 ms excluding network time, and primary views must become usable within
  2.5 seconds on the agreed browser/network test profile. Set and record that
  profile before performance acceptance; these are targets, not measured results.

## 8. Technical and delivery constraints

Use .NET for the backend and Angular for the frontend. Authentication and
authorization must remain application-owned and SQL-backed; JWTs are issued by
the application. The SQL engine, framework versions, token lifetime/storage, and
hosting environment require explicit design decisions before implementation.

Follow [AGENTS.md](../AGENTS.md) for Clean Architecture, vertical slices, frontend
library boundaries, a standalone design system, and the inherited testing rules.
Deliver incrementally: write Given–When–Then acceptance tests before production
code, verify the expected failure, implement the slice, and run relevant regression
checks. Backend checks use API integration tests; frontend checks use Chromium
Playwright with page objects. Acceptance tests must identify the requirement IDs
they cover in comments. This documentation task does not introduce automated tests.

## 9. Suggested delivery sequence

1. Establish database initialization, account permissions, seeded administrator,
   login, and the responsive application shell.
2. Deliver lead CRUD and the home directory summaries.
3. Deliver project workspaces and the full work hierarchy.
4. Deliver backlog ordering, status updates, and Kanban boards.
5. Deliver sprint planning, execution, closure, history, and mode transitions.
6. Complete cross-screen accessibility, responsiveness, performance validation,
   operational readiness, and release acceptance.

## 10. Proposed defaults and unresolved decisions

The requested stack, five lead categories, contact fields, always-present
administrator, Kanban/Scrum options, hierarchy, and responsive polished UX are
confirmed by the brief. The following are proposed defaults or design decisions
to resolve; they do not block creating this PRD:

| Topic | Initial proposal or decision needed |
| --- | --- |
| Collaboration | Administrator and Collaborator roles using the matrix above |
| Lead records | One category per record, multiple leads per category, optional phone |
| City contact | Seed Quinntyne Brown as City Lead separately from the admin account |
| Workspaces | One Toronto workspace context containing multiple projects |
| Board granularity | Stories as cards; tasks remain inside their story |
| Scrum | Sprint planning/board/history; story estimates optional; analytics deferred |
| Seed lifecycle | Initial configured password; preserve existing hashes; protect designated admin |
| SQL provider and hosting | Choose engine, deployment, migrations, and backup responsibilities |
| Session design | Choose JWT lifetime and client storage; decide whether refresh/revocation is needed |
| Quality targets | Confirm accessibility target, load fixture, network profile, and performance budgets |

## 11. Release acceptance checklist

- [ ] FR-01–FR-07 acceptance criteria pass with permitted and denied operations.
- [ ] Repeated/concurrent seeding preserves one usable highest-capability admin.
- [ ] All five lead categories and required contact fields work end to end.
- [ ] A complete hierarchy persists and invalid links/deletions are rejected.
- [ ] Kanban and Scrum both work, including failed moves and unfinished sprint work.
- [ ] UX-01–UX-04 pass across all listed viewport sizes and keyboard workflows.
- [ ] Security, audit, restart persistence, restore, and agreed performance checks pass.
- [ ] Proposed defaults affecting implementation are recorded as accepted or revised.
