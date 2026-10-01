# Review workflow mock artifacts

## Overview

Static workflow mocks support review of proposed Mission Control screens before production implementation.

- **Mock state** — named simulated rendering for loading, empty, validation, failure, conflict, or success

The existing catalog covers pages and dialogs with clearly labeled simulated results. Fictitious contact data prevents sample records from implying live application data.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The existing artifact lives at `docs/mocks/`. `index.html` catalogs screens, `viewer.html` previews widths, and `build-index.mjs` creates the index and `assets/catalog.js` manifest.
`assets/mocks.js` handles state switching, menus, column selection, and click-through without network calls or persisted application writes.
`assets/mocks.css` consumes `--mc-` tokens from the provisional `assets/tokens.css` copy. Its only literal values are media-query widths, which cannot read custom properties, and the `1px` visually-hidden pattern.
HTML metadata names screen descriptions and L2 coverage; design notes record focus, announcement, and behavior rules beyond static appearance.

The catalog illustrates login/session, home, leads, workspaces, hierarchy, backlog, Kanban, Scrum planning/board/closure/history, accounts, and audit review.
Each named screen/state remains a design input, not an approved additional requirement.
`#state=<id>` links permit direct state review; MOCK chrome remains visible around simulated application content.
Contact samples use `example.org` addresses, `555-01xx` numbers, and the UK drama range `+44 20 7946 0xxx` for international formats.
The supplied Quinntyne Brown City identity is the only real one, and no phone is invented for it.
`viewer.html` frames any mock and state at 320, 375, 576, 768, 992, 1200, 1440, and 1920 CSS pixels, 800 pixels high.
Manual review uses 375, 768, and 1440 for L2-048 and the profile R widths (320, 375, 576, 768, 992, 1200, 1920) for intended production layouts.
Regeneration uses `node docs/mocks/build-index.mjs`; this design does not alter the existing mocks.
Mocks have no ATDD or automated tests. Production Playwright specs bind `<entity>.service.mock.ts` adapters, not these static mocks, while testing application behavior.

| Behavior | Proposed boundary | Review operation |
| --- | --- | --- |
| Review workflow coverage and feedback states | `Offline catalog and state links` | `ReviewWorkflowMocks` |

Mock input and review references:

- [Mission Control mocks](../../../mocks/index.html).
- [Mock viewer](../../../mocks/viewer.html).
- [README.md](../../../mocks/README.md).

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-048` | `L1-014` | Mocks must illustrate login, home, lead directory/details/forms, work hierarchy, Kanban, Scrum planning/board/closure, and account-management workflows. They must use the design system language, identify themselves as mock/design artifacts, and use clearly fictitious contact data except the supplied City Lead identity. Mock data and simulated success must not be represented as live persisted results. This is a design artifact: no ATDD and no tests. |

## Diagrams

The context view identifies the reviewer and the standalone artifact.

![Review workflow mock artifacts: c4 context](diagrams/c4-context.png)

The container view separates editable static sources and their independent review site.

![Review workflow mock artifacts: c4 container](diagrams/c4-container.png)

The component view shows the static catalog, examples, and token source.

![Review workflow mock artifacts: c4 component](diagrams/c4-component.png)

The class view models source metadata and its composition; these are artifact concepts rather than production services.

![Review workflow mock artifacts: class structure](diagrams/class-structure.png)

Review workflow coverage and feedback states follows the sequence below. The flow traces its enforcing steps to `L2-048` and includes rejection or recovery paths.

![Review workflow coverage and feedback states](diagrams/sequence-review.png)

