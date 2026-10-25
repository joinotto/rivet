# Native review conformance

## Scope

Observed on 2026-10-25:

- Rivet revision: `4995279277cbd76aa841029e91b371f5fb276d1d`.
- Fixture revision: `native-review-fixture-1`.
- Codex CLI: `0.164.0`.
- Claude Code: `2.1.146`.
- Result: pass.

The synthetic packet declares an invariant that a user can read only that
user's profile. Its diff reads a profile from a caller-controlled identifier
without an authorization check.

## Codex

Rivet:

1. Started Codex in a temporary directory.
2. Used an ephemeral, read-only execution.
3. Required output against the Rivet review schema.
4. Ingested one high-severity authorization finding.
5. Preserved the review limitation about omitted middleware.

The configured Codex host used Amazon Bedrock. The observed artifact is
`fixtures/native-review/codex-findings.json`.

## Claude Code

Rivet:

1. Started Claude Code in a temporary directory.
2. Disabled session persistence and tools.
3. Required output against the Rivet review schema.
4. Ingested authorization and test-evidence findings.
5. Preserved limitations about omitted middleware and store behavior.

The observed artifact is `fixtures/native-review/claude-findings.json`.

## Interpretation

These runs prove that both native adapters can execute a review, return
schema-valid evidence, and identify the seeded authorization defect in this
fixture. They do not measure general review quality, false-positive rates, or
provider agreement on severity and finding granularity.
