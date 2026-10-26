# Phase 6 conformance

Observed on 2026-10-26.

Status: incomplete.

## Stateful model evidence

Evidence:

- `skills/rivet/scripts/lib/stateful.mjs`
- `test/rivet-evidence.test.mjs`

The validator requires states, commands, transitions, preconditions,
postconditions, invariants, reset behavior, isolation, seed recording,
shrinking, and command-path reachability. It reports unreachable states.

Result: pass for structural readiness.

Limitation: Rivet does not execute the property-test framework or prove that
the model matches the implementation.

## Fuzz evidence

Evidence:

- `skills/rivet/scripts/lib/fuzz.mjs`
- `scripts/run-parser-fuzz.mjs`
- `test/rivet-evidence.test.mjs`

The normalizer binds the source revision, tool, version, command digest,
configuration digest, corpus digest, dictionary digest, sanitizers, execution
time, and reproducible crash artifacts.

The bounded deterministic campaign mutates SARIF, Trivy, CycloneDX, and SPDX
structures. It rejects malformed input, compares repeated results, limits
serialized output, and treats unexpected exceptions as crashes.

The first campaign found reproducible type errors for malformed nested
structures. The normalizers now reject those structures with stable validation
errors. The same 3,000-execution campaign then completed with no crash.

Result: pass for the published evidence contract and bounded parser campaign.

Limitation: this is deterministic structure mutation, not coverage-guided
continuous fuzzing. It does not prove adequate corpus quality, path coverage,
target selection, or absence of defects.

## Chaos controls

Evidence:

- `skills/rivet/scripts/lib/chaos.mjs`
- `test/rivet-evidence.test.mjs`

An experiment cannot become ready without an explicit environment and bounded
target, exclusions, steady-state hypothesis and probes, fault duration, blast
radius, user-harm signal, stop conditions, rollback actions and verification,
observations, and named approval evidence.

Result: pass for structural readiness.

Limitation: schema validation does not authorize fault injection or prove that
the stop and rollback mechanisms work in the target environment.

## Formal evidence

Evidence:

- `skills/rivet/scripts/lib/formalize.mjs`
- `test/rivet-evidence.test.mjs`

The formal contract requires a source revision, language, module,
configuration, scope, assumptions, omitted behavior, implementation mappings,
invariants, temporal properties, deadlock selection, finite constants,
constraints, and review evidence. Result normalization preserves
counterexamples and bounded state counts.

Result: pass for the published evidence contract.

Limitation: model checking proves properties only for the supplied abstraction
and bounds. It does not prove implementation conformance.

## Privacy evidence

Evidence:

- `skills/rivet/scripts/lib/privacy.mjs`
- `test/rivet-evidence.test.mjs`

The analysis requires data categories, subjects, sources, classifications,
necessity, purposes, processing activities, flows, minimization, retention,
deletion, third parties, request handling, harms, controls, verification,
residual risks, ownership, and source revision.

The output routes legal basis and applicable-law decisions to qualified
review. It does not certify compliance.

Result: pass for engineering-analysis readiness.

Limitation: only a qualified reviewer can decide applicable law, legal basis,
and organizational acceptance.

## Capacity evidence

Evidence:

- `skills/rivet/scripts/lib/capacity.mjs`
- `test/rivet-evidence.test.mjs`

The evaluator requires a workload unit and period, measured baseline and peak,
growth assumption, service objective, measured resource capacity, instance
count, selected utilization limit, observed demand, dated price source, cost,
headroom, and explicit demand scenarios.

Result: pass for the published evidence contract.

Limitation: the calculation does not predict unmodeled quotas, queues,
failover effects, correlated bottlenecks, or future provider prices.

## Independent review

Evidence:

- `skills/rivet/scripts/lib/advanced-review.mjs`
- `skills/rivet/scripts/rivet-evidence.mjs`
- `test/rivet-evidence.test.mjs`

Rivet can create digest-bound formal, privacy, and chaos review packets. The
human record requires reviewer qualifications, independence, conflicts,
scope, findings, dispositions, residual risks, limitations, conclusion, and
signature identity.

No independent reviewer has completed a representative record for any of the
three workflows.

Result: fail.

Required evidence:

- One completed and validated formal review.
- One completed and validated privacy review by a suitably qualified reviewer.
- One completed and validated chaos review that covers approval, harm, stop,
  rollback, and recovery controls.

## Decision

The six automated and structural Phase 6 criteria pass for their published
scope. Phase 6 remains in progress because the required independent reviews
have not occurred.
