# Roadmap status

Observed on 2026-10-25.

## Completed published scopes

- Phase 2: test intelligence. See `docs/PHASE-2-CONFORMANCE.md`.
- Phase 4: data and distributed systems. See
  `docs/PHASE-4-CONFORMANCE.md`.
- Phase 5: performance and release. See `docs/PHASE-5-CONFORMANCE.md`.

These decisions apply to the exit criteria in the current roadmap. They do not
claim production certification or universal backend coverage.

## Open Phase 1 evidence

- Run native Cursor skill discovery after Cursor agent authentication is
  available.
- Test native approval and hook behavior in Cursor after authentication is
  available.
- Obtain a passing Claude Code workspace-write boundary result, or define an
  enforced operating profile that uses plan mode or an external operating
  system sandbox for mutations.

The observed Claude Code `acceptEdits` boundary failure prevents Phase 1
completion.

## Open Phase 3 evidence

- Obtain review of the threat model and finding schema from qualified security
  experts.
- Record reviewer identity, scope, revision, findings, and dispositions.

Executable fixtures cover the other published Phase 3 criteria. Automated
tests cannot substitute for the required expert review.

## Open evaluation evidence

- Recruit experienced backend and security reviewers.
- Run the same blinded fixtures and time controls used for the agent
  conditions.
- Record defects found, false positives, elapsed time, evidence completeness,
  and reviewer agreement.

The first blind campaign is descriptive until this human baseline exists.

## Advanced verification

Phase 6 has implementations for stateful models, fuzz evidence, bounded chaos,
formal-model evidence, privacy analysis, and capacity planning. The roadmap
does not define Phase 6 exit criteria. Rivet must not label this phase complete
until demand, acceptance criteria, and independent review are defined.
