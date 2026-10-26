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

Portable runner: `skills/rivet/scripts/rivet-pr-verify.mjs`

The read-only pull-request workflow checks out the exact head revision. It
derives the merge base from the exact base and head revisions in the GitHub
event. It supplies the changed paths to Rivet as a NUL-delimited file. This
format preserves commas and line breaks in valid UTF-8 paths.

The workflow:

- Derives the changed-file risk mode and review requirements. Content
  heuristics inspect only added production lines, not unchanged code,
  documentation, tests, fixtures, or GitHub configuration.
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

Native pull-request run:

- Pull request: `27`.
- Run: `40389092669`.
- Job: `121805060248`.
- Event base revision: `1789b694405148b6c1179cc9970f937aa7b167bd`.
- Event head revision: `2d27df7d57114740590a29b6bf3f9e63e72093e1`.
- Merge base: `1789b694405148b6c1179cc9970f937aa7b167bd`.
- Runner: Ubuntu 24.04.
- Node.js: `v22.23.3`.
- Risk mode: `critical`.
- Detected check: `test`.
- Verification decision: `pass`.
- Combined decision: `pass-with-limitations`.
- Workflow result: pass.
- Artifact: `rivet-pr-27-report`.
- Artifact identifier: `12680774073`.
- GitHub artifact digest:
  `sha256:1a2daeffcd7717645e768d0e9a6c784265ca29e43215dc0b80e2f46850757625`.
- Report digest:
  `sha256:3d5ddd21e8d184b86f6574b5b53cb048d4bda2ddaf0ad35735ebb77db44008e3`.
- Verification receipt digest:
  `sha256:c54790c894bb2a8be8cc8e30cedef0197c1d6cb3ea0b649ea1f4c569454f9d31`.

The first revision of pull request 27 produced a CodeQL alert for a possible
file-read race. The implementation changed to open the file once, validate
the open descriptor, and read from the same descriptor. The corrected head
revision passed the CodeQL workflow and the GitHub code-scanning status.

Result: observed pass with stated limitations.

Limitations:

- CI does not run paid native agent evaluations.
- CI does not prove behavior on macOS, Windows, every Linux distribution, or
  every supported host version.
- GitHub-hosted runner images and preinstalled software can still change
  within the named image.
- Pull-request risk signals are heuristics. Project context can require a
  higher risk mode.
