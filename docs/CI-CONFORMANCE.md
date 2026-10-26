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
migration warning. The workflow was then pinned to Ubuntu 24.04. Record the
replacement run below after it completes.

Limitations:

- CI does not run paid native agent evaluations.
- CI does not prove behavior on macOS, Windows, every Linux distribution, or
  every supported host version.
- GitHub-hosted runner images and preinstalled software can still change
  within the named image.
