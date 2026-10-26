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

The workflow configuration is present and the YAML is valid. This fact does
not prove that a GitHub-hosted run passes.

Record the workflow run identifier, action revisions, result, and important
findings after the first run on `main`. Do not claim an OpenSSF score until the
run supplies it.

## Review rule

Treat each Scorecard finding as a lead, not as proof. Confirm the affected
control in repository settings, workflow files, or release evidence before a
change.

Do not weaken a security control only to increase the numeric score.
