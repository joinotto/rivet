# Product Roadmap

## 1. Roadmap rule

Build the evidence loop before the command catalog.

Do not build all commands at the same time.

## Phase 0: Foundation

Duration: 4 to 6 weeks

Deliver:

- Project charter.
- Apache-2.0 license.
- Governance and security policies.
- Threat model for the product.
- ASD-STE100-aligned writing guide.
- Evidence schema.
- Adapter interface.
- Safe command runner.
- Redaction library.
- Reference test repositories.
- TRACE reasoning protocol.
- Database design and migration specification.
- Host integration contract.
- One canonical portable skill source.
- Eight executable reference systems with seeded defects.

Exit criteria:

- A contributor can understand the product boundary.
- The runner cannot execute an undeclared command.
- Every tool result records tool failure separately from no findings.
- The project can receive private vulnerability reports.
- Host wrappers do not fork Rivet engineering guidance.

## Phase 1: Safe change verification

Duration: 8 to 10 weeks

Status: In progress.

Implemented:

- Repository and context discovery.
- Existing check discovery.
- Selected check execution.
- JSON evidence receipt.
- Changed-file risk classification.
- TRACE change-record generation.
- ASD-STE100-aligned skill checker.
- Context-file generation with user review.
- Content-aware risk classification.
- Secret pattern scanning.
- Dependency advisory adapter discovery.
- Four-ecosystem verification fixtures.
- Stable tool adapter interface.
- Host integration contract.
- Host package generator.
- Topology-aware component and reverse-dependency impact mapping.
- Normalized dependency advisory results with seeded fixtures.
- Read-only PostgreSQL migration and JSON plan inspection.
- Cross-package conformance fixtures for all initial host distributions.
- Read-only environment and adapter readiness diagnosis.
- Reproducibility metadata with tool, command, and configuration identity.
- Markdown verification summaries.
- GitHub Actions annotations.
- Native skill discovery in Codex with Amazon Bedrock.
- Native skill discovery in Claude Code.
- Native Codex file-read, command-execution, and read-only sandbox conformance.
- Native Claude Code file-read, command-execution, and tool-allowlist
  conformance.
- Native two-turn session-resume conformance for Codex and Claude Code.
- Native Codex and Claude Code approval-policy and lifecycle-hook conformance.
- Native Codex workspace-write boundary conformance.
- Observed Claude Code `acceptEdits` outside-workspace write failure with a
  required external-sandbox mitigation.
- Canonical `shape` and `impact` commands with compatibility aliases.

Not implemented:

- Native Cursor skill discovery.
- Passing Claude Code workspace-write boundary conformance.

Commands:

- `init`
- `map`
- `shape`
- `impact`
- `database`
- `verify`
- `doctor`

Adapters:

- Git.
- Build and type checks.
- Common language test runners.
- Existing repository lint commands.
- Secret scanning.
- Dependency advisory scan.
- Database migration and plan inspection for one initial engine.

Deliver:

- `SYSTEM.md` generation with user review.
- Risk-mode selection.
- Change record.
- Evidence receipt.
- Human summary.
- CI output.
- Repository-local packages for Codex, Claude Code, and Cursor.

Exit criteria:

- The system verifies changes in at least four language ecosystems.
- It does not install a new tool when an adequate repository tool exists.
- A failed tool cannot produce a pass.
- Results are reproducible from the receipt.
- Index recommendations identify the target query and measured baseline.
- Codex, Claude Code, and Cursor pass package and native-runtime conformance suites.

## Phase 2: Test intelligence

Duration: 8 weeks

Status: Complete for the published Phase 2 scope.

Implemented:

- Package-local check discovery with preserved working directories.
- Reverse-dependency-based test selection.
- TRACE behavior, invariant, and failure-case extraction.
- Risk-based test-family planning.
- Existing coverage, mutation, property, and contract script discovery.
- Coverage-summary normalization.
- Mutation-report normalization with surviving-mutant evidence.
- JUnit property and contract result normalization.
- Repeated-JUnit flake and test-presence analysis.
- Redacted, requirements-first independent-review packets.
- Authorization-gated active API contract execution for repository-declared checks.
- Cross-ecosystem coverage normalization for Istanbul, Cobertura, JaCoCo, LCOV, and Go profiles.
- Cross-tool mutation normalization for Stryker, PIT, and cargo-mutants.
- Isolated Codex and Claude Code review adapters with schema-validated finding ingestion.
- Observed native end-to-end Codex and Claude Code reviews against a seeded
  authorization defect.
- Executable test-quality fixture where 100 percent line coverage misses a
  surviving boundary mutant and boundary tests kill it.
- Deterministically generated expected-behavior checks detect all eight seeded
  defects across eleven failure cases.

Commands:

- `test`
- `review`
- `contract`

Adapters:

- Coverage.
- Mutation testing.
- Property testing.
- API contract testing.

Deliver:

- Change-based test selection.
- Test-quality review.
- Behavior and invariant extraction.
- Independent review mode.
- Flake detection.

Exit criteria:

- Generated tests detect seeded defects in the reference repositories.
- Mutation results are better than coverage-only selection.
- The system reports test gaps and uncertainty.

## Phase 3: Secure development

Duration: 10 to 12 weeks

Status: In progress.

Implemented:

- SARIF 2.1.0 static-analysis result normalization.
- Trivy container and IaC result normalization.
- CycloneDX and SPDX structural SBOM evidence.
- Explicit SBOM source-revision binding.
- Dated CISA KEV and FIRST EPSS snapshot enrichment.
- Explicit unknown priority factors for reachability and business context.
- Expiring, owned, evidence-linked waiver templates and validation.
- Revision-bound reachability records with fail-safe unknown handling.
- Sigstore/Cosign keyless signing and identity-constrained verification adapter.
- Repository-declared SAST command discovery and gated execution.
- Structured threat-model initialization and validation with control evidence.
- Pinned GitHub CodeQL fixture with native SARIF production and expected-rule verification.
- Tool-backed CycloneDX and SPDX schema validation with embedded RSA or identity-constrained Sigstore verification.
- Pinned native Cosign signed-artifact fixture with recorded ephemeral-key
  verification conformance.

Commands:

- `threat-model`
- `security`
- `dependencies`
- `sbom`

Adapters:

- SAST.
- Secret scan.
- SCA.
- SBOM.
- container scan.
- IaC scan.
- KEV and EPSS enrichment.

Deliver:

- ASVS and CWE mapping.
- Reachability-aware dependency reports.
- Waiver workflow.
- Signed evidence artifacts.

Exit criteria:

- Security experts review the threat model and finding schema.
- Known vulnerable fixtures produce the expected findings.
- Non-reachable components do not receive false certainty.
- The system can explain why one vulnerability has priority over another.

## Phase 4: Data and distributed systems

Duration: 10 weeks

Status: Complete for the published Phase 4 scope.

Implemented:

- Declared timeout and retry call graph analysis.
- Adjacent-layer retry amplification detection.
- Timeout budget inversion detection.
- Retry and idempotency consistency review.
- Expand–migrate–validate–contract plan validation.
- Revision-bound migration dry-run and reconciliation evidence.
- Interruption and resume evidence validation.
- OpenTelemetry service identity, deployment attribute, metric cardinality, and sensitive-data review.
- Alert harm, urgency, ownership, and first-action validation.
- OTLP runtime HTTP resend and repeated client-operation discovery with nested repetition analysis.
- Reference tests for duplicate, delayed, partial, and lost-response behavior.

Commands:

- `migrate`
- `resilience`
- `observe`

Deliver:

- Expand-and-contract planner.
- Migration dry-run evidence.
- Timeout and retry graph.
- Idempotency review.
- OpenTelemetry semantic review.

Exit criteria:

- Reference tests cover duplicate, delayed, partial, and lost-response cases.
- Migration interruption and resume are tested.
- Alert recommendations connect to an SLO or user harm.

## Phase 5: Performance and release

Duration: 8 weeks

Status: Complete for the published Phase 5 scope.

Implemented:

- Workload-bound baseline and candidate comparison.
- Metric deltas without inferred direction or universal thresholds.
- Invalid comparison detection for changed workloads.
- Project-defined performance threshold evaluation.
- Staged rollout, monitoring, abort, rollback, compatibility, risk, and evidence-gap validation.
- Read-only incident mode with approval-required write records.
- Hash-chained, time-ordered incident action timeline.
- Blameless postmortem drafts from validated incident timelines.
- Repeated-sample descriptive statistics and approximate confidence intervals.
- Insufficient-sample reporting.
- Owned preventive actions with due dates and observed follow-up verification.
- Overdue preventive-action reporting.
- Approval-gated GitHub Issue synchronization with duplicate-creation prevention.

Commands:

- `performance`
- `release`
- `incident`
- `postmortem`

Deliver:

- Baseline and comparison reports.
- staged rollout plan.
- abort and rollback criteria.
- read-only incident mode.
- action timeline.

Exit criteria:

- Performance claims include workload and baseline.
- Release reports list open evidence gaps.
- Incident mode cannot write to production without explicit approval.

## Phase 6: Advanced verification

Start only after demand is clear.

Implemented:

- Stateful property-test model initialization and validation.
- Command-path reachability, invariant, reset, isolation, seed, and shrinking
  readiness checks.
- Coverage-guided fuzz campaign normalization with revision, corpus, tool,
  sanitizer, and crash-reproduction evidence.
- Bounded chaos-experiment planning and observed-result normalization.
- Required steady-state probes, target limits, stop conditions, rollback
  verification, user-harm signals, and explicit approval.
- TLA+ abstraction-contract validation and bounded model-check result
  normalization.
- Explicit assumptions, omissions, implementation mappings, finite bounds,
  counterexample preservation, and human-review evidence.
- Revision-bound privacy analysis for data categories, processing purposes,
  flows, minimization, retention, deletion, third parties, rights, and risks.
- Explicit qualified review for legal basis and applicable-law decisions.
- Workload-bound cost and capacity planning with measured resource limits,
  project-selected utilization thresholds, dated prices, headroom, and demand
  scenarios.

## 2. Reference repositories

Create small, real systems with seeded defects:

- REST service with broken authorization.
- Queue worker with duplicate side effects.
- Service with retry amplification.
- Database migration with an unsafe contraction.
- Dependency with a KEV-listed vulnerability.
- OpenTelemetry service with high-cardinality labels.
- Multi-tenant service with cross-tenant data access.

Publish every seed and expected result.

## 3. Evaluation program

Implemented:

- Machine-readable seed records.
- Deterministic precision, recall, miss, and unexpected-finding scoring.
- Published expected-finding baseline.
- Blinded comparison-campaign schema and per-condition scoring.
- Pairwise observed agreement and Cohen kappa across seeded-defect labels.
- Seed-excluding native blind-run harness for Codex and Claude Code.
- Initial observed Codex runs without Rivet, with prose-only Rivet, and with
  tool-backed Rivet.

Not implemented:

- Experienced human baseline.

Compare:

- Agent without the product.
- Agent with prose workflows only.
- Agent with workflows and deterministic tools.
- Experienced human baseline.

Measure:

- Defects found.
- Defects introduced.
- Seeded defect detection.
- False positive rate.
- Time to verified change.
- Evidence completeness.
- Reviewer agreement.

Do not evaluate from subjective report quality only.

## 4. Initial team

Minimum responsible team:

- Backend systems engineer.
- Security engineer.
- Test or quality engineer.
- Developer-tools engineer.
- Technical writer with STE training or review access.
- Maintainer responsible for open-source governance.

Do not make the security engineer a late reviewer.

## 5. First public milestone

The first public release should do one task well:

> Inspect a pull request, identify its backend risks, run the available evidence, and produce a truthful verification report.

This milestone is more valuable than 30 shallow commands.

