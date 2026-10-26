# Continuous-integration conformance

Observed on 2026-10-26.

Workflow: `.github/workflows/ci.yml`

The general workflow runs on pull requests and pushes to `main`. It checks out
and verifies the explicit pull-request head or push revision. It uses read-only
repository permissions and cancels an obsolete run for the same workflow and
Git reference.

The workflow tests the minimum supported Node.js 16 line and the current
Node.js 22 line. Each job runs:

- Behavioral tests.
- Generated host-package conformance.
- Seeded-defect evaluation.
- Bounded deterministic parser fuzzing with retained per-runtime JSON evidence.
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

Exact-revision fuzz evidence:

- Pull request: `42`.
- Run: `40397906774`.
- Revision: `751c68e64b64a377f7006f8beea5b0815fa6966c`.
- Node.js 16 job: `121835744549`.
- Node.js 16 decision: `no-crash-observed` after 3,000 executions.
- Node.js 16 artifact: `12686598527`.
- Node.js 16 artifact digest:
  `sha256:1a43c34115fe3df48c4786b26f8c39e85d3c21875debe0efb2fdf8d076ce02a9`.
- Node.js 16 report digest:
  `sha256:73c5d04b3d08daf9e3eb783bf07405f29863b876fbc44d79a861c2bce04ba9d0`.
- Node.js 22 job: `121835744607`.
- Node.js 22 decision: `no-crash-observed` after 3,000 executions.
- Node.js 22 artifact: `12686643429`.
- Node.js 22 artifact digest:
  `sha256:d9650b928bfe10121c7861332e5c799dac4a31dc1fc9e2250c95c9c3c9615e02`.
- Node.js 22 report digest:
  `sha256:d66f3e27738c8ac5ea9571d78f1105ecad42b0685d3d4c8ac491fdf8eb9f3399`.
- Both downloaded reports recorded the selected revision.

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
- Runs Rivet's deterministic secret patterns against each bounded, regular
  changed file. A finding fails the report. The retained result contains a
  fingerprint and `[REDACTED]`, not the matched value.
- Runs the checks that Rivet detects in the checked-out project.
- Lists detected security and dependency adapters that it does not run
  automatically, with the safety reason and explicit workflow to use.
- Writes the machine-readable impact, verification receipt, combined report,
  and Markdown summary.
- Writes a revision-bound manifest with the byte size and SHA-256 digest of
  every retained evidence file.
- Provides offline manifest verification through
  `rivet-pr-verify.mjs verify-report <report-directory>`.
- Adds GitHub workflow annotations for pass, fail, incomplete, and unavailable
  results.
- Retains the report artifact for 14 days, including on a failed check.

The workflow has only `contents: read` permission. It does not run in the
privileged `pull_request_target` context, persist checkout credentials, post a
comment, approve a change, deploy code, or claim production behavior.

The `Backend risk and evidence` job is a strict required check on `main`.
GitHub reported the check under the GitHub Actions application after the
protection update on 2026-10-26.

Implementation tests cover exact revision binding, unusual UTF-8 filenames,
secret redaction, secret-driven failure, report composition, manifest
verification, read-only permissions, and the absence of the privileged
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

Changed-file secret-scan run:

- Pull request: `40`.
- Run: `40396171897`.
- Job: `121829695402`.
- Base and merge-base revision:
  `629e174aad5aa2cd4996053be54259b428a49cfc`.
- Head revision: `846ed6c089e28ab4b588907dbf4bc99a5c4402aa`.
- Secret-scan decision: pass.
- Potential secrets: `0`.
- Combined decision: `pass-with-limitations`.
- Workflow result: pass.
- Artifact: `rivet-pr-40-report`.
- Artifact identifier: `12685074163`.
- GitHub artifact digest:
  `sha256:ce1a34a2b3a6ea873202a0533b24a76a2436da6a319c3ccd8424774366d4f236`.
- Manifest digest:
  `sha256:5f40ba46bf55ee6c535b302bc8361c92c25ef31e4bbf1ddfe7b8d2f7fc8238fe`.
- Report digest:
  `sha256:f8784c7637f7531db23eaa003fcb6359748a4d1b2234d8aeeda2850cf44ca3ab`.
- Secret-scan digest:
  `sha256:f1fca5739d6fba6cf70302ffa81c1cd62efe356070c2a8e9c32d5f981e386276`.
- Offline manifest verification: pass for all six retained evidence files.

Result: observed pass with stated limitations.

Manifest verification run:

- Pull request: `33`.
- Workflow run: `40392510055`.
- Job: `121816882371`.
- Event head revision: `5037a38c33f9a8c55175fa2716407c021995445d`.
- Artifact: `rivet-pr-33-report`.
- Artifact identifier: `12685375581`.
- GitHub artifact digest:
  `sha256:49dc73d48ab8a7f973a23f20cbd1d5ba1873e371cdd2bcf5028eae7a34dbb50d`.
- Downloaded manifest digest:
  `sha256:668608eb9bcd13a5077f2f63087e846e7d3c17a3116452a81c09a665e3d42127`.
- Manifest-bound files: 5.
- Offline verification decision: pass.

The portable verifier read the downloaded artifact outside the repository and
validated its inventory, revision bindings, byte sizes, and SHA-256 digests.

Result: observed pass.

Limitations:

- CI does not run paid native agent evaluations.
- CI does not prove behavior on macOS, Windows, every Linux distribution, or
  every supported host version.
- GitHub-hosted runner images and preinstalled software can still change
  within the named image.
- Pull-request risk signals are heuristics. Project context can require a
  higher risk mode.
