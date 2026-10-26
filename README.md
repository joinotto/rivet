# Rivet

Status: active Phase 1 implementation; published Phases 0, 2, 4, and 5 complete
Date: 2026-10-26
Product name: Rivet

## Current implementation

Version `0.1.0` contains:

- A repository-local `rivet` agent skill.
- The TRACE engineering reasoning protocol.
- Focused database, testing, security, and system-design references.
- A dependency-free evidence runner for Node.js 16 or later.
- Project and context-file discovery.
- Existing test, lint, type-check, and build-script discovery.
- Initial Rust, Go, and Python test discovery.
- Dry-run verification.
- Selected check execution.
- Changed-file risk classification.
- TRACE change-record generation.
- ASD-STE100-aligned Markdown checks.
- JSON evidence receipts.
- Distinct pass, fail, incomplete, and insufficient-evidence results.
- Context-file initialization that preserves existing files.
- Content-aware risk classification.
- Secret-pattern scanning with redacted findings.
- Dependency-audit adapter discovery.
- A stable tool-adapter schema.
- A host-integration contract for Codex, Claude Code, Cursor, and compatible tools.
- Topology discovery for components, internal dependency edges, data-store artifacts, and messaging dependencies.
- Reverse dependency impact for changed workspace components.
- Normalized npm, Cargo, Go, and Python dependency-audit results.
- Read-only PostgreSQL migration SQL and JSON query-plan inspection.
- Read-only context, configuration, and tool-readiness diagnosis.
- Tool versions and configuration digests in verification receipts.
- Markdown human summaries and GitHub Actions annotations.
- Monorepo package-local check execution and dependency-aware test selection.
- TRACE requirement extraction and risk-based test-family planning.
- Istanbul, Cobertura, JaCoCo, LCOV, and Go coverage normalization.
- Stryker, PIT, and cargo-mutants result normalization.
- Property and contract-test artifact normalization.
- Flake and inconsistent test-selection detection from repeated JUnit runs.
- Project-selected quality ratchets for weakened metrics, removed assertions,
  new suppressions, skipped tests, and expiring exceptions.
- Requirements-first, redacted independent-review packet generation.
- SARIF, Trivy, CycloneDX, and SPDX security evidence normalization.
- Official CycloneDX and SPDX schema validation with embedded or Sigstore signature verification.
- Reproducible CISA KEV and FIRST EPSS snapshot enrichment.
- Expiring security waiver templates and structural validation.
- Revision-bound vulnerability reachability evidence.
- Sigstore/Cosign evidence-signing and identity-constrained verification plans.
- Explicitly authorized execution of repository-declared SAST commands.
- A pinned GitHub CodeQL fixture that produces and normalizes native SARIF.
- Timeout, retry-amplification, idempotency, and deadline-budget analysis.
- OTLP runtime resend, repeated-client-operation, and nested-retry analysis.
- Expand-and-contract migration plan and dry-run evidence validation.
- OpenTelemetry semantic, cardinality, sensitive-data, and alert review.
- Workload-bound performance baseline and candidate comparison.
- Threshold-based staged release decisions with explicit rollback and evidence gaps.
- Read-only, approval-aware, hash-chained incident timelines.
- Blameless postmortem drafts from validated incident evidence.
- Repeated-sample performance statistics with explicit adequacy limits.
- Owned preventive actions with due dates and follow-up verification.
- Approval-gated GitHub Issue synchronization for preventive actions.
- Deterministic seeded-defect precision and recall evaluation.

Run the tests:

```sh
cd rivet
npm test
npm run test:fixtures
```

Inspect a project:

```sh
node skills/rivet/scripts/rivet-evidence.mjs inspect
```

Initialize missing project context:

```sh
node skills/rivet/scripts/rivet-evidence.mjs init
```

Preview its detected checks:

```sh
node skills/rivet/scripts/rivet-evidence.mjs verify --dry-run
```

Analyze change impact:

```sh
node skills/rivet/scripts/rivet-evidence.mjs impact
```

Shape a change with a TRACE record:

```sh
node skills/rivet/scripts/rivet-evidence.mjs shape \
  --title "Order authorization" \
  --output .rivet/changes/order-authorization.md
```

The older `change` and `record` names remain as compatibility aliases.

Check skill documentation:

```sh
npm run check:ste
```

Preview dependency-audit adapters:

```sh
node skills/rivet/scripts/rivet-evidence.mjs dependencies --dry-run
```

Preview active API contract checks:

```sh
node skills/rivet/scripts/rivet-evidence.mjs contract --dry-run
```

Execution requires `--target` and `--allow-network`. A non-local target also
requires `--allow-nonlocal-target`.

Create a threat-model record:

```sh
node skills/rivet/scripts/rivet-evidence.mjs threat-model init \
  --system "Order API" \
  --output .rivet/threat-model.json
```

Validate it with `threat-model validate --file .rivet/threat-model.json`.

Prepare the security-expert review packet:

```sh
node skills/rivet/scripts/rivet-evidence.mjs security-review packet \
  --threat-model .rivet/threat-model.json \
  --output .rivet/security-review-packet.json
```

Use `security-review init` to create the reviewer record and
`security-review validate` after the qualified reviewer completes it.
For a Markdown threat model, also supply `--system` and `--revision`.

Run an isolated independent review:

```sh
node skills/rivet/scripts/rivet-evidence.mjs review run \
  --packet .rivet/reviews/change.json \
  --provider codex \
  --output .rivet/reviews/change-findings.json \
  --allow-network
```

Codex and Claude Code are supported. External JSON findings can use
`review ingest`.

Generate host packages:

```sh
npm run package:hosts
```

This command creates packages for Codex, Claude Code, Cursor, and portable skill hosts from the canonical `skills/rivet/` source.

Run package conformance:

```sh
npm run test:hosts
```

This test does not claim native host-runtime conformance.

## Decision

Build it.

Do not build a large prompt library.

Build an evidence-driven engineering system for AI coding agents. The system must help an agent to design, test, secure, operate, and change backend software. It must use proven external tools. It must save durable system context. It must show the evidence for each claim.

## Product thesis

Backend work has the same coordination problem that Impeccable solves for frontend work:

- The agent does not know the product constraints.
- The agent does not know the architecture decisions.
- The agent applies generic patterns.
- The agent changes code before it understands failure modes.
- The agent writes tests that only confirm its own implementation.
- The agent reports security from static inspection without proof.
- The agent optimizes local code and damages system behavior.
- The agent does not preserve operational knowledge.

The product can correct these problems if it combines:

1. Durable context.
2. A repeatable engineering reasoning method.
3. Focused engineering playbooks.
4. Database design and verification.
5. Executable verification.
6. Risk-based security controls.
7. Test and runtime evidence.
8. Safe agent permissions.
9. Open-source governance.

## Non-negotiable rule

The product must separate these result classes:

- **Observed:** A tool or runtime produced the evidence.
- **Derived:** The system calculated the result from observed evidence.
- **Inferred:** The agent formed a conclusion from incomplete evidence.
- **Unknown:** The system does not have sufficient evidence.

The product must not present an inferred result as an observed result.

## Documents

- [Research foundation](RESEARCH-FOUNDATION.md)
- [Engineering reasoning method](ENGINEERING-REASONING.md)
- [Database design guide](DATABASE-DESIGN.md)
- [Product specification](PRODUCT-SPECIFICATION.md)
- [Command and workflow catalog](COMMAND-CATALOG.md)
- [Security and evidence model](SECURITY-MODEL.md)
- [Roadmap](ROADMAP.md)
- [Roadmap status and open evidence](docs/ROADMAP-STATUS.md)
- [Open-source foundation](OPEN-SOURCE-FOUNDATION.md)
- [Technical writing rules](TECHNICAL-WRITING.md)
- [ASD-STE100 for agent skills](docs/ASD-STE100-FOR-SKILLS.md)
- [Addy Osmani agent-skills audit](docs/ADDY-AGENT-SKILLS-AUDIT.md)
- [Host integration contract](docs/HOST-INTEGRATIONS.md)
- [Native SAST conformance](docs/NATIVE-SAST-CONFORMANCE.md)
- [Native signature conformance](docs/NATIVE-SIGNATURE-CONFORMANCE.md)
- [Native review conformance](docs/NATIVE-REVIEW-CONFORMANCE.md)
- [Native host conformance](docs/HOST-CONFORMANCE.md)
- [Initial blind evaluation](docs/BLIND-EVALUATION-2026-10-25.md)
- [Phase 2 conformance](docs/PHASE-2-CONFORMANCE.md)
- [Phase 4 conformance](docs/PHASE-4-CONFORMANCE.md)
- [Phase 5 conformance](docs/PHASE-5-CONFORMANCE.md)
- [Seeded reference systems](fixtures/reference-systems/README.md)

## Honest assessment

The opportunity is strong. The scope is dangerous.

The first release must have a narrow purpose:

> Help an agent make a safe backend change and prove that the change works.

Do not start with autonomous penetration testing, production incident control, compliance certification, or a universal architecture generator. These areas have high risk and weak verification.

Start with repository context, change-risk analysis, test selection, deterministic checks, dependency risk, threat modeling, and an evidence report.

## Validation status

The evidence-runner behavioral tests pass on Node.js 16.13.1.

The portable validator checks skill frontmatter, folder identity, reference
links and anchors, package boundaries, empty directories, and orphaned
reference documents.

The behavioral tests, skill validator, and Rivet STE checker pass in the development environment.


