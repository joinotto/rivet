# Phase 2 conformance

Observed on 2026-10-25.

## Generated tests detect seeded defects

Evidence:

- `fixtures/reference-systems/run-generated-tests.mjs`
- `fixtures/reference-systems/generated-test-evidence.json`

The generator creates expected-behavior checks from published seed contracts
in a temporary directory. Eleven checks cover all eight seeds. Every check
fails against the defective implementation, including duplicate, delayed,
partial, and lost-response cases. The harness removes temporary workspace
paths before it calculates output digests, so repeated runs are reproducible.

Result: pass.

Limitation: the generator has fixture-class adapters. This result does not
prove general test generation for unknown systems.

## Mutation adds evidence beyond line coverage

Evidence:

- `fixtures/test-quality/run-evidence.mjs`
- `fixtures/test-quality/evidence/coverage-summary.json`
- `fixtures/test-quality/evidence/weak-mutation.json`
- `fixtures/test-quality/evidence/strong-mutation.json`

The weak suite executes 100 percent of the source lines but accepts a change
from `age >= 18` to `age > 18`. The mutation evidence reports the mutant as
survived. Tests at ages 17 and 18 kill the same mutant.

Result: pass.

Limitation: one non-equivalent boundary mutant does not establish a universal
relationship between coverage and mutation score.

## Test gaps and uncertainty remain explicit

Evidence:

- Missing change-record inputs appear in `missing_inputs`.
- Surviving mutants produce `test-gaps`.
- Empty JUnit or single-run flake evidence produces `insufficient-evidence`.
- Tool failures remain separate from test findings.
- Coverage reports state that execution does not prove defect detection.

These behaviors have assertions in `test/rivet-evidence.test.mjs`.

Result: pass.

## Decision

Phase 2 exit criteria are satisfied for the published scope. Native reviewer
execution has observed Codex and Claude Code evidence. Later evaluation work
must still measure larger systems, repeated runs, and an experienced-human
baseline.
