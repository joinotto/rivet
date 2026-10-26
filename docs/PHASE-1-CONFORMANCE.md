# Phase 1 conformance

Observed on 2026-10-26.

Status: incomplete.

## Four language ecosystems

Evidence:

- `skills/rivet/scripts/lib/adapters.mjs`
- `test/rivet-evidence.test.mjs`

The discovery fixture creates Node.js, Rust, Go, and Python project markers.
Rivet discovers the repository-native test adapter for each ecosystem and
preserves package working directories.

Result: pass for discovery and adapter selection.

Limitation: the fixture does not compile or test a representative production
project in each language.

## Existing tools before new tools

Evidence:

- `docs/ADAPTER-CONTRACT.md`
- `skills/rivet/scripts/lib/adapters.mjs`
- `skills/rivet/scripts/rivet-evidence.mjs`
- `test/rivet-evidence.test.mjs`

Rivet discovers repository scripts and ecosystem manifests. The safe runner
executes only a discovered adapter. It does not contain an installation path.
Missing optional tools are unavailable and cannot become a pass.

Result: pass.

Limitation: Rivet cannot determine that a repository script is adequate from
its name alone. An accountable reviewer must assess tool fitness.

## Failed tools cannot pass

Evidence:

- `docs/EVIDENCE-SCHEMA.md`
- `skills/rivet/scripts/lib/dependencies.mjs`
- `skills/rivet/scripts/rivet-evidence.mjs`
- `test/rivet-evidence.test.mjs`

The tests cover failed repository checks, missing executables, invalid
dependency-tool output, and valid dependency findings that use a nonzero exit
status. Tool failure produces `fail`, `incomplete`, or `tool-failure`. It does
not produce `pass`.

Result: pass.

## Receipt reproducibility

Evidence:

- `docs/EVIDENCE-SCHEMA.md`
- `skills/rivet/scripts/rivet-evidence.mjs`
- `test/rivet-evidence.test.mjs`

A verification receipt records the source revision, platform, architecture,
Node.js version, adapter schema, ecosystem, working directory, executable,
arguments, tool version, command digest, configuration digest, source,
timestamps, exit status, redacted output, and limitations.

Result: pass for the published receipt contract.

Limitation: a receipt cannot recreate an unavailable tool binary, external
service, mutable registry, secret, production dataset, or operating-system
state. Networked workflows need dated source snapshots or separately retained
artifacts.

## Measured index recommendations

Evidence:

- `skills/rivet/scripts/lib/postgres.mjs`
- `skills/rivet/scripts/rivet-evidence.mjs`
- `test/rivet-evidence.test.mjs`

The PostgreSQL index workflow requires:

- A query identifier, purpose, and statement digest.
- A workload source, environment, dataset, and observation window.
- Baseline and candidate plan artifacts.
- Baseline and candidate sample counts and p95 latency.
- The candidate index definition and write-cost evidence.

A faster measured candidate produces a recommendation for the named query.
A slower candidate produces `recommendation-not-supported`.

Result: pass.

Limitation: the result applies only to the supplied workload and evidence. It
does not prove production planner stability or acceptable storage, locking,
maintenance, and write-amplification effects.

## Host package and native-runtime conformance

Package evidence:

- `scripts/package-hosts.mjs`
- `scripts/test-host-packages.mjs`

Native evidence:

- `docs/HOST-CONFORMANCE.md`
- `fixtures/host-conformance/`

All portable, Codex, Claude Code, and Cursor packages pass artifact inventory,
digest, manifest, install-path, inspection, verification, and redaction
checks.

Codex passes native discovery, tool-boundary, session, approval-hook, and
workspace-write probes. Claude Code passes native discovery, tool-boundary,
session, and approval-hook probes. Its `acceptEdits` workspace probe failed
because the host created an outside-workspace marker.

The workspace probe was repeated on 2026-10-26 with the standalone Claude Code
2.1.146 executable selected explicitly. The inside write succeeded and the
outside marker existed. The result remains a fail. The new evidence records
the executable, version, and command digest.

Cursor package conformance passes. Native discovery, approval, hook, session,
and boundary behavior remain untested. Cursor 2.2.36 is installed, but
`cursor agent status` reports `Not logged in`.

Result: fail for the published exit criterion.

Required evidence:

- Authenticate Cursor and run the native conformance suites.
- Obtain a passing Claude Code workspace boundary, or publish and test an
  enforced mutating profile that uses an operating-system sandbox.

## Decision

Phase 1 remains in progress. Five exit criteria pass for their published
scope. The combined package and native-runtime criterion does not pass.
