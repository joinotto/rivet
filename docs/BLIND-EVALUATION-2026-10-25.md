# Blind evaluation: 2026-10-25

## Scope

This initial campaign used Codex CLI `0.164.0` with the configured Amazon
Bedrock provider. Each arm received the eight reference-system source files in
a new temporary directory.

The runner excluded all `seed.json` files and the expected-findings baseline.

Conditions:

- Agent without Rivet: source files only.
- Prose-only Rivet: source files and the canonical `SKILL.md`.
- Tool-backed Rivet: source files and the canonical skill with its read-only
  scripts.

## Observed result

| Condition | Seed recall | Unmatched findings | Duration |
| --- | ---: | ---: | ---: |
| Agent without Rivet | 8 of 8 | 1 | 15.611 seconds |
| Prose-only Rivet | 8 of 8 | 1 | 22.354 seconds |
| Tool-backed Rivet | 8 of 8 | 1 | 37.219 seconds |

All three arms identified every fixture that contains a published seed. Each
arm reported two findings for the distributed-failure fixture, which has one
published aggregate seed. The scorer therefore records one unmatched finding
per arm. A human has not adjudicated those findings as false positives.

Observed pairwise seed-label agreement was 1. Cohen kappa is undefined because
all three reviewers marked every seed positive, so the sample has no label
variance.

## Interpretation

This campaign does not show that Rivet improved defect recall. The fixtures are
small and easy to inspect, and all arms reached the recall ceiling.

The tool-backed arm added explicit migration-tool evidence and more detailed
evidence limitations. It also took longer. One run per condition is not enough
to estimate stable quality, time, or cost effects.

The campaign remains incomplete because it has no experienced-human baseline.
It also does not measure defects introduced during implementation because the
task was review-only.

Artifacts:

- `fixtures/evaluation-runs/codex-without-rivet.json`
- `fixtures/evaluation-runs/codex-prose-only.json`
- `fixtures/evaluation-runs/codex-tool-backed.json`
- `fixtures/evaluation-runs/codex-campaign.json`
