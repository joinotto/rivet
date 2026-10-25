# Phase 5 conformance

Observed on 2026-10-25.

## Performance claims include workload and baseline

Evidence:

- `skills/rivet/scripts/lib/performance.mjs`
- `test/rivet-evidence.test.mjs`

Rivet requires baseline and candidate artifacts to contain a workload. It
rejects the comparison when the workload digests differ. Valid reports keep
the workload, baseline values, candidate values, and measured deltas.

Result: pass.

Limitation: comparable inputs do not prove that the workload represents
production or that the sample size is adequate.

## Release reports list open evidence gaps

Evidence:

- `skills/rivet/scripts/lib/release.mjs`
- `test/rivet-evidence.test.mjs`

The release evaluator returns each non-passing or missing evidence record in
`evidence_gaps`. A gap, an invalid plan, an unaccepted critical risk, or a
failed performance threshold prevents a ready decision.

Result: pass.

Limitation: the result depends on the completeness and truth of supplied
evidence and risk records.

## Incident writes require explicit approval

Evidence:

- `skills/rivet/scripts/lib/incident.mjs`
- `test/rivet-evidence.test.mjs`

Incident events use read mode by default. Rivet rejects a write-mode event
without an approval reference. Timeline validation also rejects a stored write
event that has no approval.

Result: pass.

Limitation: Rivet records and validates declared actions. It does not connect
to a production control plane, perform a production write, or verify that an
external action occurred.

## Decision

Phase 5 exit criteria are satisfied for the published scope. A
`ready-for-human-approval` decision does not deploy or authorize a release.
