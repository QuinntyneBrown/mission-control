# Rehearse backup and restore

## Overview

Release recovery restores all committed Toronto account, contact, project, and delivery records into an isolated environment.

- **Backup point** — database state captured by the provider-specific backup procedure
- **Restore rehearsal** — documented recovery exercise performed against a separate target, preserving the source environment

The restored administrator retains any changed password, and closed sprint history remains unchanged.

This design refines the [L2 baseline](../../../specs/L2.md) and its linked L1 scope. Proposed defaults retain their proposal status.

## Description

This operational slice introduces a release runbook and provider-specific commands, not an application HTTP endpoint.
The chosen SQL provider, framework versions, deployment topology, backup command, restore command, and backup storage facility are `<TO SUPPLY>`.
Schedule, retention, backup encryption/access, responsible operator, and restoration credentials are `<TO SUPPLY>` before release.
The rehearsal record identifies source and target explicitly; the target is isolated before any restore runs.
An operator creates a populated backup with accounts, five lead categories, complete hierarchies, board ordering, sprint plans, and closed history.

The recovery procedure restores schema/data to a separate SQL target and supplies external signing/configuration material independently.
`DatabaseInitializer` checks compatible schema and repairs administrator access while preserving ID and existing password hash.
Verification compares identities, references, orders, counts, scope snapshots, and recorded outcomes with the backup point.
API integration checks authenticate with the changed administrator password and read representative lead/work/board/history records.
The runbook records backup point, start/end instants, verification results, failures, and the latest rehearsal outcome.
An incomplete rehearsal leaves release readiness unresolved. No source database overwrite occurs in this design.

| Behavior | Proposed boundary | Proposed operation |
| --- | --- | --- |
| Capture a populated backup | `Provider backup command: <TO SUPPLY>` | `CaptureBackupOperation` |
| Restore and verify isolated recovery | `Provider restore command: <TO SUPPLY>` | `RestoreBackupOperation` |

Mock input and review references:

No workflow mock represents this operational capability. The operational flow follows the linked L2 acceptance criteria.

## Requirements

Requirement text and identifiers below are copied verbatim from L2, including the source use of `must`.

| L2 ID | Refines (L1) | Requirement |
| --- | --- | --- |
| `L2-007` | `L1-002` | The seed must avoid duplicates, preserve existing passwords and restore the designated account's active status and highest capabilities. |
| `L2-026` | `L1-006` | Closed sprint history must preserve its name, goal, planned dates, actual start/ close instants, initial and final scope, and story IDs, titles, statuses, and carryover destinations as recorded at closure. Later edits, reparenting, or permitted deletions must not rewrite these recorded outcomes. |
| `L2-040` | `L1-011` | Committed account, contact, hierarchy, ordering, board, and sprint changes must survive restart. Operations spanning multiple records must commit entirely or leave all affected business records unchanged. |
| `L2-044` | `L1-012` | Release documentation must identify the chosen SQL provider, backup commands, schedule/retention, storage access, restore steps, responsible operator, and verification procedure. A restore rehearsal must recover a populated database into a separate environment before release. Recovery must not reset existing administrator passwords or rewrite historical sprint results. |

## Diagrams

The context view identifies the actor and the Mission Control capability.

![Rehearse backup and restore: c4 context](diagrams/c4-context.png)

The container view separates operational execution, API verification, and the durable SQL environment.

![Rehearse backup and restore: c4 container](diagrams/c4-container.png)

The component view locates the initialization or release procedure and its verification boundaries.

![Rehearse backup and restore: c4 component](diagrams/c4-component.png)

The class view identifies operational configuration, outcome records, and initialization relationships.

![Rehearse backup and restore: class structure](diagrams/class-structure.png)

Capture a populated backup follows the sequence below. The flow traces its enforcing steps to `L2-044` and includes rejection or recovery paths.

![Capture a populated backup](diagrams/sequence-backup.png)

Restore and verify isolated recovery follows the sequence below. The flow traces its enforcing steps to `L2-044` and includes rejection or recovery paths.

![Restore and verify isolated recovery](diagrams/sequence-restore.png)

