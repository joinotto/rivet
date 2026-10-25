# Phase 4 conformance

Observed on 2026-10-25.

## Distributed failure cases

Evidence:

- `fixtures/reference-systems/run-generated-tests.mjs`
- `fixtures/reference-systems/generated-test-evidence.json`

Generated expected-behavior tests cover duplicate delivery, delayed events,
partial completion, and a lost response. All four checks detect the published
distributed-system defect.

Result: pass.

Limitation: the fixture uses an in-memory system and published contracts. It
does not prove behavior for an unknown production system.

## Migration interruption and resume

Evidence:

- `fixtures/migration-resume/run-evidence.mjs`
- `fixtures/migration-resume/evidence.json`

The fixture stops after a bounded batch, keeps cursor 2, and resumes from the
next row. Five source rows reconcile with five migrated and validated rows.
No row is applied twice.

Result: pass.

Limitation: the fixture does not model database locks, replicas, process
crashes during cursor persistence, or concurrent writes.

## Alerts connect to user harm

Evidence:

- `skills/rivet/scripts/lib/observe.mjs`
- `test/rivet-evidence.test.mjs`

Rivet rejects an alert definition that does not state harm, urgency, owner,
and first action. The report also states that an SLO or an explicit user-harm
threshold is still necessary when applicable.

Result: pass for the published criterion, which permits an SLO or user harm.

Limitation: Rivet validates the supplied telemetry model. It does not observe
whether a deployed alert uses the reviewed definition.

## Decision

Phase 4 exit criteria are satisfied for the published scope. A production
migration still requires representative data, interruption tests, recovery
tests, lock observations, and workload evidence.
