# Phase 0 conformance

Observed on 2026-10-26.

## Product boundary

Evidence:

- `PRODUCT-SPECIFICATION.md`
- `README.md`
- `OPEN-SOURCE-FOUNDATION.md`
- `THREAT-MODEL.md`

These documents define Rivet's purpose, users, scope, risk model, limitations,
and open-source operating model. They state that Rivet helps an accountable
reviewer and does not replace one.

Result: pass.

Limitation: documentation cannot prove that every contributor interprets the
boundary in the same way.

## Declared command execution

Evidence:

- `docs/ADAPTER-CONTRACT.md`
- `skills/rivet/scripts/lib/adapters.mjs`
- `skills/rivet/scripts/rivet-evidence.mjs`
- `test/rivet-evidence.test.mjs`

Rivet discovers commands from explicit repository files and creates structured
adapters. The runner passes an executable and argument array without a shell.
A requested check that has no detected adapter is recorded as unavailable and
is not executed.

Result: pass.

Limitation: a repository-declared package script can run arbitrary project
code. The adapter boundary prevents Rivet from inventing a command. It is not a
sandbox for repository code.

## Tool failure and no findings

Evidence:

- `docs/EVIDENCE-SCHEMA.md`
- `skills/rivet/scripts/lib/dependencies.mjs`
- `skills/rivet/scripts/rivet-evidence.mjs`
- `test/rivet-evidence.test.mjs`

Dependency adapters parse supported machine-readable output before they
classify a result. Valid empty output is a pass. Invalid output or an execution
error is a tool failure. A tool failure makes the workflow incomplete and
cannot produce a pass.

Result: pass.

Limitation: adapters can only distinguish results that their documented output
formats represent.

## Private vulnerability reports

Evidence:

- `SECURITY.md`
- GitHub private vulnerability reporting for `joinotto/rivet`

The repository has GitHub private vulnerability reporting enabled. The
security policy gives the exact user-interface route for a confidential
report and states what evidence a reporter must include.

Result: pass.

Limitation: response-time targets remain deferred until the first public
release.

## Canonical host guidance

Evidence:

- `docs/HOST-INTEGRATIONS.md`
- `scripts/package-hosts.mjs`
- `scripts/test-host-packages.mjs`

All host packages are generated from `skills/rivet`. Package conformance
compares SHA-256 digests for the canonical skill and every domain reference.
Codex metadata is the only intentional content difference.

Result: pass.

Limitation: the digest checks cover generated Rivet packages. A user can still
modify an installed copy after generation.

## Decision

Phase 0 exit criteria are satisfied for the published scope. This decision
does not claim that repository scripts are safe to trust, that documentation
is complete, or that the current release is production-certified.
