# Mission Control mocks

Static HTML mocks of every page, dialog, notification, and pop-up in the
[PRD](../PRD.md) and [L2 requirements](../specs/L2.md) (L2-048). They are design
artifacts: reviewed by hand, with no tests and no ATDD.

Open [`index.html`](index.html) in a browser. It works offline from `file://`.

- **States.** Each mock is one file. The dark MOCK bar at the top has a **State**
  menu for its loading, empty, error, validation, conflict, and role variants.
  `#state=<id>` links straight to a state, for example
  `leads/lead-form-dialog.html#state=conflict`.
- **Design notes.** The strip under the MOCK bar describes behaviour a picture
  can't show: focus, screen-reader announcements, and the rules behind each state.
- **Responsive review.** [`viewer.html`](viewer.html) frames any mock and state at
  320, 375, 768, 1440, or 1920px. Every mock works from 320px to 1920px without
  page-level horizontal scrolling.
- **Data.** All contact and work data is fictitious (`example.org` addresses,
  `555-01xx` numbers). The only real identity is Quinntyne Brown, the City Lead.
  Forms never submit and nothing is saved or sent.

## Files

| Path | Contents |
| --- | --- |
| `index.html` | Catalog of every mock and state, plus L2-048 workflow coverage |
| `viewer.html` | Responsive preview at the review widths |
| `assets/tokens.css` | Provisional `--mc-` design tokens: colour, spacing, type, radius, focus, elevation |
| `assets/mocks.css` | Shared styles. Values come only from tokens; `.mock-*` classes are mock chrome |
| `assets/mocks.js` | State switching, menus, column selector, and click-through. No network calls |
| `assets/catalog.js` | Mock manifest used by the viewer (generated) |
| `build-index.mjs` | Regenerates `index.html` and `assets/catalog.js` |
| `auth/` `shell/` `home/` `leads/` `projects/` `work/` `backlog/` `kanban/` `scrum/` `admin/` `feedback/` | One file per page or dialog |

The standalone design system (`design-system/`) will adopt the tokens in
`assets/tokens.css` under the same `--mc-` prefix. Its copy will then be the
authoritative one, and this file should mirror it.

## Conventions for editing

- **Markup and states.** Markup shows the default state. Elements for other states
  carry `data-when="state-a state-b"` and `hidden`. Use `data-unless` to hide an
  element in some states. Use `data-attr-<state>="name=value|!name"` to change
  attributes such as values, `aria-invalid`, or `disabled`. The header of
  `assets/mocks.js` lists every hook.
- **Role variants.** A state can set `data-role=collaborator` on `<body>`. That
  hides `.mock-admin-only` and shows `.mock-collaborator-only`.
- **Styling.** Reuse `.mc-*` classes. New styles go in `assets/mocks.css` and read
  only `var(--mc-*)` tokens. Don't use inline styles or `<style>` blocks.
- **Index.** Run `node docs/mocks/build-index.mjs` to regenerate `index.html` and
  `assets/catalog.js`. They're built from each mock's `<title>`, `description`,
  and `mock-requirements` meta tags and its state menu. When adding a mock, keep
  those accurate and add the file to the list in `build-index.mjs`.
