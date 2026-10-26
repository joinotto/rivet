# Roadmap status

Observed on 2026-10-25.

Release-candidate build and verification conformance was observed on
2026-10-26. See `docs/RELEASE-CANDIDATE-CONFORMANCE.md`.

## Completed published scopes

- Phase 0: foundation. See `docs/PHASE-0-CONFORMANCE.md`.
- Phase 2: test intelligence. See `docs/PHASE-2-CONFORMANCE.md`.
- Phase 4: data and distributed systems. See
  `docs/PHASE-4-CONFORMANCE.md`.
- Phase 5: performance and release. See `docs/PHASE-5-CONFORMANCE.md`.

These decisions apply to the exit criteria in the current roadmap. They do not
claim production certification or universal backend coverage.

## Open Phase 1 evidence

See `docs/PHASE-1-CONFORMANCE.md` for the criterion-by-criterion record.

- Run native Cursor skill discovery after Cursor agent authentication is
  available.
- Test native approval and hook behavior in Cursor after authentication is
  available.

Claude Code now has a passing, tested macOS external-sandbox profile.
Unsandboxed `acceptEdits` still fails, and Apple marks the compatibility
sandbox command as deprecated. Cursor evidence is the remaining Phase 1 exit
criterion blocker.

## Open Phase 3 evidence

See `docs/PHASE-3-CONFORMANCE.md` for the criterion-by-criterion record.

- Obtain review of the threat model and finding schema from qualified security
  experts.
- Record reviewer identity, scope, revision, findings, and dispositions.

The prepared packet and incomplete reviewer record are in
`docs/security-review/`.

Executable fixtures cover the other published Phase 3 criteria. Automated
tests cannot substitute for the required expert review.

## Open evaluation evidence

- Recruit experienced backend and security reviewers.
- Run the same blinded fixtures and time controls used for the agent
  conditions.
- Record defects found, false positives, elapsed time, evidence completeness,
  and reviewer agreement.

The first blind campaign is descriptive until this human baseline exists.
Use `npm run evaluate:human -- prepare` to create a seed-free packet and
`npm run evaluate:human -- ingest` to validate the signed reviewer record.

## Advanced verification

See `docs/PHASE-6-CONFORMANCE.md` for the criterion-by-criterion record.

Phase 6 has implementations for stateful models, fuzz evidence, bounded chaos,
formal-model evidence, privacy analysis, and capacity planning. Product demand
and explicit exit criteria are now recorded in `ROADMAP.md`.

Open Phase 6 evidence:

- Obtain independent review of one representative formal artifact.
- Obtain qualified review of one representative privacy artifact.
- Obtain independent review of one representative chaos artifact, including
  its approval, stop, harm, and rollback controls.

Rivet must not label Phase 6 complete until these reviews are recorded.
