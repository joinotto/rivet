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

Not implemented:

- Native Codex, Claude Code, and Cursor runtime conformance.

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

Candidates:

- Stateful property testing.
- Coverage-guided fuzzing.
- Chaos experiments.
- TLA+ model generation and model checking.
- Privacy analysis.
- Cost and capacity planning.

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

