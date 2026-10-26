# OpenSSF Scorecard

> This document uses an ASD-STE100-aligned technical writing style. It is not a
> certified ASD-STE100 document.

## Configuration

`.github/workflows/scorecard.yml` runs OpenSSF Scorecard:

- After a change to `main`.
- After a branch protection change.
- Each Saturday at 01:30 UTC.
- After a manual workflow request.

The workflow:

- Uses Ubuntu 24.04.
- Sets a 15-minute job limit.
- Uses commit-pinned actions.
- Does not persist checkout credentials.
- Gives write permissions only to the analysis job.
- Publishes the Scorecard result.
- Uploads SARIF as a five-day workflow artifact.
- Uploads SARIF to GitHub code scanning.

## Permission rationale

The job uses `contents: read` to inspect the repository.

The job uses `security-events: write` to upload SARIF to code scanning.

The job uses `id-token: write` to publish the result through the Scorecard
action. No other write permission is granted.

## Evidence status

The first GitHub-hosted run passed:

- Run: `40362452737`.
- Revision: `021c5fee7985701bcc5b46d6ff0bb2027a1dfc22`.
- Event: push to `main`.
- Result: success.
- Started: 2026-10-26 16:47:15 UTC.
- Completed: 2026-10-26 16:47:50 UTC.

The run uploaded its SARIF artifact and code-scanning result.

## First finding review

| Check | Reported score | Review |
| --- | ---: | --- |
| Security Policy | 4 | The policy had no machine-detected link. Add the private advisory link. |
| Fuzzing | 0 | Valid gap. Keep open until a suitable parser or trust-boundary target exists. |
| SAST | 7 | Partial control. Add repository-wide CodeQL on pull requests and `main`. |
| Vulnerabilities | 1 | The scanner found the intentional Log4j 2.14.1 evaluation fixture. It is not a runtime dependency. Add a fixture-local OSV exception with the reported advisory identifiers. |
| Maintained | 0 | Expected for a repository created less than 90 days ago. Do not bypass it. |
| Code Review | 0 | Valid governance gap. One maintainer cannot supply independent human approval. |
| OpenSSF Best Practices | 0 | Valid gap. Complete the project assessment before a public release. |

The SARIF artifact did not include a reliable overall score. This document does
not claim one.

GitHub created Dependabot alerts 1 through 8 for the intentional Log4j fixture.
The maintainers dismissed each alert with reason `not_used` and a comment that
identifies the evaluation-only scope. The GitHub REST API does not provide a
`used_in_tests` reason. Reopen an alert if the manifest becomes part of a build,
package, example application, or executable test.

## Remediation run

The remediation run passed:

- Run: `40364326312`.
- Revision: `a12aabfb374c2d602c2102ddddaa1262a0b985bf`.
- Event: push to `main`.
- Result: success.
- Date: 2026-10-26.

The second SARIF artifact no longer reports the Security Policy or
Vulnerabilities findings. GitHub reports no open Dependabot alert.

The SAST check remains at 7 because CodeQL covered 2 of the 7 recent commits at
the time of the run. Repository-wide CodeQL is now a required branch check.
Coverage will increase as new commits use the required workflow. Do not create
unnecessary commits to change this metric.

The following findings remain valid:

- Fuzzing.
- Repository age and maintenance history.
- Independent human code review.
- OpenSSF Best Practices assessment.

The remediation result does not prove that these remaining controls are
complete.

## Review rule

Treat each Scorecard finding as a lead, not as proof. Confirm the affected
control in repository settings, workflow files, or release evidence before a
change.

Do not weaken a security control only to increase the numeric score.
