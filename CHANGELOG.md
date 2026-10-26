# Changelog

This file records notable changes to Rivet.

## Unreleased

### Changed

- Candidate verification now enforces SLSA statement source, builder,
  invocation, normalization, subject, and byproduct semantics.
- Release-candidate conformance now records a native exact-revision in-toto
  Statement with the SLSA v1 provenance predicate and downloaded-artifact
  verification.
- Release-candidate verification rejects symbolic-link roots and reads each
  retained artifact once through a bounded, no-follow file descriptor.
- Release-candidate output is restricted to a non-symbolic directory inside
  the project, including when forced replacement is requested. The security
  baseline now reflects existing revision-bound CycloneDX generation.
- Phase 6 and CI conformance now record native, exact-revision fuzz reports
  for both supported Node.js runtimes.
- Phase 6 and CI conformance now record the native Jazzer.js/libFuzzer
  campaign, including exact revision, corpus growth, decisions, and artifact
  digests.
- Security baseline status now reflects the completed OpenSSF Scorecard run
  and finding review. Pull-request secret-scan conformance records the native
  artifact and offline manifest verification.

### Added

- A bounded, content-addressed persistent corpus for coverage-guided parser
  fuzzing. Pull requests can consume trusted corpus state, but only successful
  default-branch runs can publish the next cache.
- An isolated, lockfile-pinned Jazzer.js/libFuzzer workspace and
  exact-revision CI campaign for the SARIF, Trivy, CycloneDX, and SPDX
  normalizers, with retained report, corpus, and crash inputs.
- Deterministic unsigned in-toto Statements with the SLSA v1 provenance
  predicate, explicit local-builder trust limits, resolved source identity,
  subjects, and byproducts for release candidates.
- Retained exact-revision bounded parser-fuzz evidence for both supported
  Node.js CI jobs, including failed campaigns. CI verifies the explicit
  pull-request head or push revision before it creates evidence.
- Deterministic changed-file secret scanning in every pull-request evidence
  report, with redacted findings, fail-closed decisions, and manifest-bound
  scan evidence.
- Full OSV dependency scans on pushes to `main` and manual release-evidence
  runs, while preserving pull-request diff scans.
- A revision-bound pull-request report manifest with byte sizes and SHA-256
  digests for every retained evidence file, plus fail-closed offline
  verification.
- A read-only pull-request workflow that binds exact revisions, preserves
  unusual UTF-8 filenames, classifies backend risk, runs detected checks, and
  retains a truthful evidence report. The runner is part of the portable skill
  package.
- A fail-closed open-source foundation conformance check for required project,
  license, maintainer, support, and security-reporting artifacts.
- OpenSSF assessment validation for missing, duplicate, escaping, symbolic-link,
  and unsupported local evidence references.
- Repository-wide SPDX copyright and license metadata with official REUSE
  compliance checks in CI.
- A manual, read-only workflow that builds, verifies, and temporarily retains
  an unsigned candidate for an exact default-branch revision.
- Revision-bound release evidence drafts that fail closed on missing gates,
  signatures, risks, or independent approvals.
- Safe artifact-path and digest verification for every release gate and signed
  approval record.
- Structured GitHub issue forms and a pull-request evidence template with
  explicit private-security routing.
- Contributor Covenant 2.1 with a verified private conduct-report route,
  confidentiality rules, conflict escalation, and decision review.
- Release evidence gates for compatibility, versioned changelog entries, and
  version-bound support and security channels.
- An explicit macOS Claude Code compatibility launcher that fails closed and
  restricts writes to the current real workspace path.
- Deterministic unsigned release-candidate archives with checksums, CycloneDX
  SBOM, source-bound provenance, and byte-reproducibility tests.
- Offline, fail-closed verification for candidate inventory, archive metadata,
  checksums, SBOM binding, and provenance binding.
- Explicit native-host executable selection with recorded CLI version and
  command provenance.
- Bounded deterministic fuzz execution for SARIF, Trivy, CycloneDX, and SPDX
  normalization boundaries.
- OpenSSF baseline-3 assessment, secure-development and testing policies, and
  pull-request OSV dependency scanning.
- OpenSSF baseline-2 evidence assessment, documented sensitive-access holders,
  and required DCO sign-off verification.
- Machine-validated OpenSSF baseline-1 evidence assessment and repository
  ignore rules for generated, local, and credential-bearing files.
- Required CodeQL branch protection and observed Scorecard remediation
  evidence.
- Repository-wide CodeQL analysis and an evidence-based review of the first
  OpenSSF Scorecard findings.
- Commit-pinned OpenSSF Scorecard analysis with SARIF artifact and code
  scanning uploads.
- Complete vulnerability disclosure policy, weekly GitHub Actions dependency
  updates, and a repository security baseline record.
- Enforced `main` branch protection with required Node.js 16 and 22 checks,
  plus a documented single-maintainer review limitation.
- General CI across Node.js 16 and 22, plus maintainer, support, release, and
  architecture documentation required by the open-source foundation.
- Pinned Ubuntu 24.04 CI runner and an observed CI conformance record.
- Observed passing GitHub CI evidence for the pinned runner on Node.js 16 and
  Node.js 22.
- Phase 6 criterion-by-criterion conformance record with independent-review
  gates kept explicit.
- Digest-bound independent-review packets and human-review validation for
  formal, privacy, and chaos evidence.
- Seed-excluding experienced-human baseline packet preparation and signed
  result ingestion for evaluation campaigns.
- Phase 3 criterion-by-criterion conformance record with the qualified-review
  gate kept explicit.
- Source-supplied CWE and OWASP ASVS identifier preservation in SARIF
  normalization.
- Phase 1 criterion-by-criterion conformance record with native-host failures
  kept explicit.
- Query-bound PostgreSQL index recommendations with measured baseline and
  candidate evidence.
- Markdown threat-model support for digest-bound expert-review packets.
- Prepared Rivet threat-model and finding-schema packet for qualified external
  security review.
- Complete host-package inventory, digest, manifest, capability, and install
  path drift checks.
- Project-selected quality-ratchet evidence for weakened metrics, removed
  assertions, new suppressions, skipped tests, and expiring exceptions.
- Deterministic Rivet routing contract with positive, negative, and
  verification-pressure cases.
- Machine-readable skill-change rejection ledger with retry conditions and
  deterministic validation.
- Phase 6 demand, risk-based scope, testable exit criteria, and explicit
  independent-review requirements.
- Phase 0 conformance record, actionable private vulnerability reporting, and
  digest checks that bind packaged host guidance to the canonical skill.
- Digest-bound security-expert review packets and human-review records with
  qualification, independence, conflict, scope, finding, and conclusion checks.
- Portable skill-package validation for frontmatter, references, anchors,
  package boundaries, empty directories, and orphan documents.
- Pinned source and test audit of Addy Osmani's agent-skills repository, with
  explicit Rivet adoption and rejection decisions.
- Native approval and hook conformance probe that records lifecycle events,
  denies a requested shell mutation, and verifies the mutation is absent.
- Roadmap status record that keeps native-host, security-review, human-baseline,
  and Phase 6 acceptance gaps explicit.
- Phase 5 conformance record for workload-bound performance, release evidence
  gaps, and approval-required incident writes.
- Phase 4 conformance record for distributed failure cases, migration resume,
  and alert-to-harm requirements.
- Executable migration interruption and cursor-based resume evidence with
  duplicate-application and reconciliation checks.
- Phase 2 conformance record that binds each exit criterion to executable
  evidence and documented limitations.
- Reproducible generated-test evidence that removes temporary workspace paths
  before it calculates failure-output digests.
- Deterministic expected-behavior test generation that detects all eight
  published seeds across eleven reference failure cases.
- Executable test-quality evidence where complete line coverage misses a
  boundary mutant and focused boundary tests kill it.
- Native workspace-write boundary probes, including a passing Codex result and
  an observed Claude Code `acceptEdits` outside-workspace write failure.
- Native two-turn Codex and Claude Code session-resume probes with nonce
  retention evidence.
- Native Codex read-only sandbox and Claude Code tool-allowlist conformance
  probes with observed read, command, and prohibited-write evidence.
- Seed-excluding native blind-evaluation runner and initial Codex comparison
  artifacts for no-Rivet, prose-only, and tool-backed conditions.
- Blinded evaluation-campaign scoring with per-condition metrics and pairwise
  reviewer agreement.
- Native Codex and Claude Code review conformance against a seeded
  authorization defect.
- Workload-bound cost and capacity planning with measured limits, dated prices,
  scenario evaluation, headroom, and monthly cost.
- Revision-bound engineering privacy analysis with data-minimization,
  retention, deletion, third-party, request, and qualified-review controls.
- TLA+ abstraction-contract and model-check evidence with explicit bounds,
  omissions, implementation mappings, and counterexample handling.
- Bounded chaos-experiment planning and result evidence with mandatory stop,
  rollback, user-harm, and approval controls.
- Coverage-guided fuzz campaign evidence with reproducibility and crash
  triage fields.
- Stateful property-test model initialization and validation with command-path
  reachability and reproducibility checks.
- Native Cosign v3 signed-artifact conformance for an offline, self-managed
  key fixture.
- ASD-STE100 research for agent skills.
- Rivet technical-writing reference.
- Markdown checker for deterministic faults and heuristic warnings.
- Changed-file risk classification.
- TRACE change-record generation.
- Tests for local, service, and critical workflow results.
- Context-file initialization.
- Content-aware risk classification.
- Secret-pattern scanning and output redaction.
- Dependency-audit discovery.
- Stable tool-adapter and host-integration contracts.
- Four-ecosystem discovery fixtures.
- Host package generator for Codex, Claude Code, Cursor, and portable hosts.
- Repository topology discovery and reverse dependency impact.
- Normalized dependency advisory findings and tool failures.
- Read-only PostgreSQL migration and query-plan inspection.
- Cross-package inspection, verification, and redaction conformance fixtures.
- Read-only `doctor` diagnostics for context, configuration, and tools.
- Reproducibility metadata, Markdown summaries, and GitHub Actions output.
- Native skill-discovery evidence for Codex with Amazon Bedrock and Claude Code.
- Monorepo check discovery and reverse-dependency-based test selection.
- TRACE requirement extraction and risk-based test-family planning.
- Test-intelligence script discovery and artifact normalization.
- Repeated-JUnit flake and test-presence analysis.
- Requirements-first independent-review packet generation.
- Eight executable backend reference systems with stable seeded defects.
- SARIF, Trivy, CycloneDX, and SPDX security evidence normalization.
- Dated CISA KEV and FIRST EPSS vulnerability enrichment.
- Expiring, owned security waiver templates and validation.
- Revision-bound vulnerability reachability evidence.
- Sigstore/Cosign keyless evidence-signing adapter.
- Gated execution of repository-declared SAST commands.
- Timeout, retry amplification, idempotency, and deadline-budget analysis.
- Expand-and-contract migration plan and dry-run validation.
- OpenTelemetry semantic, cardinality, sensitive-data, and alert review.
- Workload-bound performance evidence comparison.
- Project-threshold and staged-rollout release decisions.
- Read-only, approval-aware incident action timelines.
- Blameless postmortem drafts from validated timelines.
- Repeated-sample performance statistics and adequacy reporting.
- Preventive-action ownership, due dates, and follow-up verification.
- Seeded-defect precision, recall, miss, and unexpected-finding evaluation.

### Changed

- Made release evidence drafts automatically bind verified host packages,
  SBOM, and provenance from the candidate instead of reporting host packages
  as missing.
- Made the backend risk and evidence report a strict required check on the
  protected `main` branch.
- Made verification receipts disclose detected security and dependency
  adapters that were not run automatically, including the required explicit
  workflow.
- Updated the roadmap to distinguish the completed pull-request milestone
  implementation from the unreleased public product.
- Limited pull-request content-risk signals to added production lines. The
  classifier excludes unchanged code, documentation, tests, fixtures, and
  GitHub configuration from content heuristics.
- Made the ASD-STE100-aligned profile optional and risk-based.
- Limited STE routing to consequential procedures and formal evidence.
- Defined Rivet as host-independent and model-provider-independent.

## 0.1.0 — 2026-10-25

### Added

- Initial Rivet skill.
- Database, testing, security, and system-design references.
- Repository inspection.
- Existing check discovery and execution.
- JSON evidence receipts.
- Research, product, security, governance, and roadmap documents.

