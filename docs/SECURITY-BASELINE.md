# Repository Security Baseline

> This document uses an ASD-STE100-aligned technical writing style. It is not a
> certified ASD-STE100 document.

## Purpose

This document records the repository security controls for Rivet. Repository
settings are external state. Recheck them before each public release.

## Disclosure

`SECURITY.md` defines:

- The supported version.
- The private report route.
- The required report information.
- Response targets.
- Coordinated disclosure.
- Reporter credit.
- CVE assessment.
- The current safe-harbor status.

Private vulnerability reporting is enabled in the GitHub repository.

## Source and workflow controls

The repository uses:

- Protected `main` branch settings.
- Required pull requests.
- Required Node.js 16 and Node.js 22 checks.
- Required repository-wide CodeQL analysis.
- Required OSV dependency-difference scanning.
- Full OSV dependency scanning on each push to `main` and on manual release
  evidence runs.
- Linear history.
- Resolved review conversations before merge.
- Read-only default workflow permissions.
- Commit-pinned third-party GitHub Actions.
- Native static-analysis and signature workflows.
- Repository-wide CodeQL analysis on pull requests and `main`.
- OpenSSF Scorecard analysis with SARIF upload.

See `docs/BRANCH-PROTECTION.md`, `docs/CI-CONFORMANCE.md`, and
`docs/OPENSSF-SCORECARD.md`.

## Dependency controls

`.github/dependabot.yml` requests weekly GitHub Actions update pull requests.
Dependabot vulnerability alerts and security updates are enabled in the
repository settings.

The project currently has no runtime package dependencies. Recheck the update
configuration when a package ecosystem or lock file is added.

Exact-revision full-scan conformance:

- Workflow run: `40394485453`.
- Job: `121823782336`.
- Source revision: `11057ede7b9e246fe5e0bd8291938d4459d0a676`.
- Trigger: push to `main`.
- OSV Scanner: `v2.7.0`.
- Scan result: pass.
- SARIF upload: pass.
- Artifact identifier: `12685408323`.
- GitHub artifact digest:
  `sha256:7f1c7ad1b3bd711e7f4b6084d6c36310da315f945ba842294786095eec55a95a`.

The pull-request diff job correctly skipped on the push event. This result can
support the dependency gate only for the recorded source revision.

## Secret controls

The repository enables:

- Secret scanning.
- Push protection.

The required pull-request report also runs Rivet's read-only secret patterns
against bounded, regular changed files. It rejects a finding and retains only
a fingerprint and a redacted value. Pattern scanning can miss unknown formats.
It does not replace provider scanning, secret validity checks, confirmation, or
credential rotation.

These controls reduce risk. They do not prove that the repository has no
secrets. Contributors must not commit credentials.

GitHub reports non-provider pattern scanning and secret validity checks as
disabled. The repository owner must recheck whether the current GitHub plan and
organization policy make these controls available.

## Remaining work

The following controls are not complete:

- Observed OpenSSF Scorecard run and finding review.
- Official OpenSSF Best Practices submission and badge.
- GitHub non-provider secret pattern scanning.
- Secret validity checks.
- Release artifact signing.
- Software bill of materials generation.
- Build provenance attestation.
- Fuzzing for future parsers and trust-boundary code.

Add each control only when Rivet has the related code or release artifact.

The local baseline-1, baseline-2, and baseline-3 evidence assessments are in
`docs/openssf-baseline-assessment.json` and
`docs/openssf-baseline-2-assessment.json`, and
`docs/openssf-baseline-3-assessment.json`. Baseline-1 identifies organization
multi-factor authentication as not met. Baseline-3 identifies independent
human approval as not met. A local assessment is not a badge.
