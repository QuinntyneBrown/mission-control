# Review the standalone design language

## Overview

The standalone design system documents Mission Control's visual language independently of the application runtime.

- **Design token** — prefixed CSS custom property representing a visual role
- **Specimen** — visual example of a control or responsive pattern

The current mock tokens are provisional; the design system becomes their authoritative owner.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The [shared design rules](../../README.md#shared-design-rules) apply: proposed type status, Application placement and MediatR `12.5.0`, authentication and validation V, responsive profile R and accessibility, token styling, data ownership and session handling, and incremental ATDD. This page records feature-specific behavior and exceptions only.
Exception: as an L2-047 design artifact, the design system has no ATDD and no automated tests; production workflows receive their own behavioral acceptance checks.

The proposed `design-system/` contains its own `package.json`, build command, static catalog, token stylesheet, breakpoint source, and control/layout specimens.
`--mc-` is the shared prefix already used by `docs/mocks/assets/tokens.css`.
The initial catalog adopts color, spacing, typography, radius, focus, elevation, size, and motion roles from that provisional stylesheet.
Its copy becomes authoritative. Missing roles are added to the authoritative stylesheet before component styles use them.

The static build bundles the token reference and examples without depending on the API or Angular application's runtime.
The hosting destination, build tooling, deployment command, and maintainer are `<TO SUPPLY>`.
CSS custom properties cannot supply media-query conditions, so the design system publishes named breakpoints from its package as Sass mixins.
Its breakpoint source follows profile R: `sm`, `md`, `lg`, and `xl` start at 576, 768, 992, and 1200 pixels, `xs` lies below 576, and `short` covers viewports under 560 pixels tall.
Component stylesheets reference only those names, for example `@include mc-bp.up(md)`. Literal widths exist once, in the design system's breakpoint source.
Component rules read tokens for every dimension, font, spacing, and color.

The build emits the two mirror sources: `dist/tokens.css` holds every `--mc-` custom property, and `dist/_breakpoints.scss` holds the named breakpoint mixins.
A `sync-tokens` script copies both without changing them. In `frontend/`, `npm run sync-tokens` writes `frontend/styles/tokens.css` and `frontend/styles/_breakpoints.scss`.
For the mocks, `node docs/mocks/sync-tokens.mjs` writes `docs/mocks/assets/tokens.css` and `docs/mocks/assets/_breakpoints.scss`.
Each copy starts with a header comment naming the source design-system version from `design-system/package.json` and the latest commit that changed `design-system/`.
The script refuses to run while `design-system/` has uncommitted changes, so that header identifies the exact source. Mirrored files are never edited by hand.
Review confirms a mirror by rebuilding the design system at the recorded commit, rerunning `sync-tokens`, and checking that the mirrored files are unchanged.
The script is build tooling and the comparison is manual review; neither introduces a test.

Manual review opens the built site independently and resizes through each profile R width from 320 to 1920 pixels, including control focus and compact/expanded specimens.
Contrast, status text, touch size, and zoom examples communicate the proposed accessibility baseline.

| Behavior | Proposed boundary | Review operation |
| --- | --- | --- |
| Build and manually review token specimens | `Standalone static build / preview` | `ReviewDesignLanguage` |

Mock input and review references:

- [assets/tokens.css](../../../mocks/assets/tokens.css).
- [README.md](../../../mocks/README.md).

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-032` | `L1-008` | Production views must use the application design tokens and consistent typography, spacing, focus, form, and status patterns. Loading, empty data, zero search results, and request errors must be distinguishable and offer relevant actions. Visual review is for application UX; design artifacts themselves remain exempt from automated tests. |
| `L2-035` | `L1-009` | The application must meet the proposed WCAG 2.2 AA target. Normal text must reach 4.5:1 contrast, large text 3:1, and essential control boundaries/focus/status graphics 3:1 against adjacent colors. Status must include text or another non-color cue. Primary touch controls must provide at least 44×44 CSS-pixel targets; other controls must satisfy applicable AA target-size requirements. |
| `L2-047` | `L1-014` | The design system must live at `design-system/` beside backend/frontend, have its own package/build, and be deliverable as a standalone static site without an application runtime dependency. It must own authoritative prefixed CSS tokens for color, spacing, typography, radii, and focus, with visual examples of controls and responsive patterns. This is a design artifact: no ATDD and no tests. |

## Diagrams

The context view identifies the reviewer, the standalone artifact, and the token mirrors that copy it.

![Review the standalone design language: c4 context](diagrams/c4-context.png)

The container view separates the editable sources, their build output, and the frontend and mock mirrors.

![Review the standalone design language: c4 container](diagrams/c4-container.png)

The component view shows the static catalog, examples, token and breakpoint sources, their built mirror sources, and the `sync-tokens` copies.

![Review the standalone design language: c4 component](diagrams/c4-component.png)

The class view models source metadata, its composition, and the provenance of each mirrored file; these are artifact concepts rather than production services.

![Review the standalone design language: class structure](diagrams/class-structure.png)

Build and manually review token specimens follows the sequence below. The flow traces its enforcing steps to `L2-047` and includes rejection or recovery paths.

![Build and manually review token specimens](diagrams/sequence-review.png)

