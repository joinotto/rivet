# Continuous-integration conformance

Observed on 2026-10-26.

Workflow: `.github/workflows/ci.yml`

The general workflow runs on pull requests and pushes to `main`. It uses
read-only repository permissions and cancels an obsolete run for the same
workflow and Git reference.

The workflow tests the minimum supported Node.js 16 line and the current
Node.js 22 line. Each job runs:

- Behavioral tests.
- Generated host-package conformance.
- Seeded-defect evaluation.
- Portable skill-package validation.
- Skill-change rejection validation.
- Skill-routing contract tests.
- Rivet technical-writing checks.

Official GitHub actions use immutable commit identifiers. The runner image is
fixed to Ubuntu 24.04.

Initial observed run:

- Run: `40352052450`
- Revision: `302d205b47b3e5f0fcc1849ca1e5785103030fe7`
- Node.js 16: pass.
- Node.js 22: pass.

This first run used `ubuntu-latest` and emitted a planned runner-image
migration warning.

Pinned-runner verification:

- Run: `40352338749`
- Revision: `ae66fddc136206ccec429df9b9b544a90ee1842f`
- Runner: Ubuntu 24.04.
- Node.js 16: pass.
- Node.js 22: pass.

Result: pass.

## Pull-request verification report

Workflow: `.github/workflows/pr-verification.yml`

The read-only pull-request workflow checks out the exact head revision. It
derives the merge base from the exact base and head revisions in the GitHub
event. It supplies the changed paths to Rivet as a NUL-delimited file. This
format preserves commas and line breaks in valid UTF-8 paths.

The workflow:

- Derives the changed-file risk mode and review requirements.
- Runs the checks that Rivet detects in the checked-out project.
- Writes the machine-readable impact, verification receipt, combined report,
  and Markdown summary.
- Adds GitHub workflow annotations for pass, fail, incomplete, and unavailable
  results.
- Retains the report artifact for 14 days, including on a failed check.

The workflow has only `contents: read` permission. It does not run in the
privileged `pull_request_target` context, persist checkout credentials, post a
comment, approve a change, deploy code, or claim production behavior.

Implementation tests cover exact revision binding, unusual UTF-8 filenames,
report composition, read-only permissions, and the absence of the privileged
pull-request trigger.

Native GitHub Actions conformance is not yet recorded for this workflow.

Limitations:

- CI does not run paid native agent evaluations.
- CI does not prove behavior on macOS, Windows, every Linux distribution, or
  every supported host version.
- GitHub-hosted runner images and preinstalled software can still change
  within the named image.
- Pull-request risk signals are heuristics. Project context can require a
  higher risk mode.
