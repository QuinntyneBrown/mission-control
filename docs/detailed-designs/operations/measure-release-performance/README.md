# Measure release workflow performance

## Overview

Release measurement assesses the application's responsiveness under the proposed initial workload.

- **Operation class** — distinct read or write behavior whose server latency is reported independently
- **Cold-view run** — Chromium navigation with a cold frontend cache that measures time until essential content and controls are usable

Budgets are proposed targets; this design contains no measured performance claim.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

The proposed release harness lives under `backend/tests` for API behavior/load checks and `e2e` for Chromium page workflows.
It calls existing production endpoints and page objects, rather than introducing a public performance endpoint.
Fixture generation creates 1,000 leads, 10,000 work items, and 50 workspaces with both modes and closed history in an isolated environment.
Shared account/service mocks remain appropriate for frontend acceptance checks; cold-page performance additionally runs against the isolated populated API so network budgets are meaningful.

Separate app and SQL instances each use 4 vCPUs, 8 GiB RAM, SSD storage, and at most 2 ms inter-instance round-trip latency.
The browser uses installed Chromium, four logical cores, 8 GiB RAM, 20 Mbps throughput, and 40 ms API round-trip latency.
The manifest records exact framework/browser/SQL versions, configuration, fixture, and hardware; these are `<TO SUPPLY>` until measured.
After one minute of warm-up, 25 authenticated sessions each issue one request per second for ten minutes.
The operation mix is 60% reads and 40% permitted writes; read classes include directory/search, backlog, board batches, and history.
Write classes include lead/work edits, moves, and sprint planning. Fixture allocation avoids accidental expected conflicts masking latency or error results.

Each operation class reports p95 server duration at most 500 ms, excluding client/network time, with no unexpected 5xx or integrity failure.
Home, Leads, Backlog, and Active board each receive 30 cold-cache runs; p95 usable-view time targets at most 2.5 seconds.
The harness checks persisted identity, parent, ordering, and sprint invariants through behavioral API outcomes after load.
All collection APIs retain default 25 and maximum 100 records; SQL indexes align with directory filters, sibling/backlog positions, membership, and board queries.
A measured bottleneck informs a targeted change only after evidence; this design adds no background cache or queue.
A different environment receives a separate report and does not claim this profile passed.

| Behavior | Proposed boundary | Proposed operation |
| --- | --- | --- |
| Measure proposed concurrent API workload | `Existing protected feature endpoints` | `MeasureApiLoadOperation` |
| Measure cold Chromium view readiness | `Home / Leads / Backlog / Active board routes` | `MeasureColdViewsOperation` |

Mock input and review references:

No workflow mock represents this operational capability. The operational flow follows the linked L2 acceptance criteria.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-045` | `L1-013` | Directories, workspace lists, backlogs, and history lists must default to 25 records per page and cap requested page size at 100. Invalid sizes must return 400. Results must include total matching count and stable ordering. Boards/hierarchies must load bounded batches of at most 100 and allow access to every matching item; counts must reflect the full dataset rather than just loaded records. |
| `L2-046` | `L1-013` | The proposed acceptance workload is 1,000 leads and 10,000 work items across 50 workspaces with both delivery modes and sprint history. Measure on separate app and SQL instances, each with 4 vCPUs and 8 GiB RAM, SSD storage, and ≤2 ms app/SQL round-trip latency. The browser profile is current installed Chromium, four logical CPU cores, 8 GiB RAM, 20 Mbps network throughput and 40 ms API round-trip latency. Record exact versions, configuration, fixture, and hardware in results. Run 25 authenticated concurrent sessions at one request per second each for 10 minutes after one minute of warm-up: 60% reads, 40% permitted writes. Reads must include directory/search, backlog, board batches, and sprint history; writes must include lead/work edits, card moves, and sprint planning. Report p95 by operation class rather than pooling all operations. These budgets are proposed targets, not measured claims. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Measure release workflow performance: c4 context](diagrams/c4-context.png)

The container view separates operational execution, API verification, and the durable SQL environment.

![Measure release workflow performance: c4 container](diagrams/c4-container.png)

The component view locates the initialization or release procedure and its verification boundaries.

![Measure release workflow performance: c4 component](diagrams/c4-component.png)

The class view identifies operational configuration, outcome records, and initialization relationships.

![Measure release workflow performance: class structure](diagrams/class-structure.png)

Measure proposed concurrent API workload follows the sequence below. The flow traces its enforcing steps to `L2-046` and includes rejection or recovery paths.

![Measure proposed concurrent API workload](diagrams/sequence-load.png)

Measure cold Chromium view readiness follows the sequence below. The flow traces its enforcing steps to `L2-046` and includes rejection or recovery paths.

![Measure cold Chromium view readiness](diagrams/sequence-cold-views.png)

