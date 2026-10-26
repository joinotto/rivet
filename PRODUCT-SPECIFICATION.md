# Product Specification

## 1. Purpose

The product helps an AI coding agent to make safe backend changes.

The product is independent of one coding-agent host or model provider.

The product supplies:

- System context.
- A repeatable engineering reasoning method.
- Engineering workflows.
- Database design guidance.
- Tool orchestration.
- Risk controls.
- Evidence reports.

## 2. Initial users

Primary users:

- Backend developers who use coding agents.
- Platform and site-reliability engineers.
- Security engineers who review development work.
- Open-source maintainers.

Secondary users:

- Engineering managers.
- Quality engineers.
- Technical writers.
- Compliance teams that need control evidence.

The product must not replace an accountable reviewer.

## 3. Core jobs

The user must be able to:

1. Explain a system to an agent one time.
2. Plan a change before code modification.
3. identify affected contracts, data, and failure modes.
4. Select the correct tests for the risk.
5. Run security and dependency checks.
6. verify a database or API migration.
7. Review performance and reliability evidence.
8. produce a release decision with traceable evidence.
9. preserve decisions for the next agent session.

## 4. Context model

The product must read existing standard files before it creates new files.

Recommended records:

| File | Purpose |
|---|---|
| `PRODUCT.md` | Users, purpose, constraints, and business-critical actions |
| `SYSTEM.md` | System boundaries, runtime topology, modules, dependencies, and data stores |
| `ARCHITECTURE.md` | Current architecture and design principles |
| `SECURITY.md` | Security policy and vulnerability-reporting process |
| `THREAT-MODEL.md` | Assets, trust boundaries, threats, mitigations, and open risks |
| `RELIABILITY.md` | SLIs, SLOs, error budgets, failure policy, and capacity assumptions |
| `TESTING.md` | Test strategy, environments, fixtures, data policy, and quality risks |
| `DATA.md` | Data ownership, classification, stores, integrity rules, retention, and recovery |
| `OPERATIONS.md` | Deployment, rollback, backup, recovery, and ownership |
| `docs/adr/*.md` | Architecture decision records |
| `openapi.*` or equivalent | Machine-readable service contract |
| `.Rivet/config.*` | Shared and local product configuration |

Do not duplicate facts across many files. Link to the source of truth.

## 5. Change record

Each material change must have a short change record.

Required fields:

- Purpose.
- User or system outcome.
- In scope.
- Out of scope.
- Current behavior.
- Required behavior.
- Invariants.
- Data changes.
- Interface changes.
- Threat changes.
- Failure and recovery cases.
- Rollout and rollback.
- Verification plan.
- Owners and approvals.

The record can be an issue, pull request, or local Markdown file.

## 6. Risk modes

The product must use the change risk, not one fixed workflow.

### Mode A: Local

Examples:

- Pure function.
- Internal refactor.
- Documentation.

Required evidence:

- Focused tests.
- Static checks.
- No contract or data change.

### Mode B: Service

Examples:

- API behavior.
- Queue consumer.
- Authorization logic.
- Database query.

Required evidence:

- Contract tests.
- Integration tests.
- Threat and failure review.
- Observability review.

### Mode C: Distributed

Examples:

- Cross-service workflow.
- Retry behavior.
- Event schema.
- Data migration.

Required evidence:

- Invariants.
- Duplicate and partial-failure tests.
- Compatibility plan.
- Rollout and rollback proof.
- Load or fault tests when applicable.

### Mode D: Critical

Examples:

- Authentication.
- Payments.
- Encryption.
- Privileged operations.
- Destructive migration.
- Safety or regulated data.

Required evidence:

- Human security approval.
- Independent test design.
- Explicit threat model.
- Strong change controls.
- Staged rollout.
- Recovery exercise.
- Formal specification when the state logic needs it.

## 7. Engine architecture

The product should have five layers.

### 7.1 Host integration layer

The initial host integrations connect Rivet to Codex and Claude Code only.
Cursor and other host integrations are future work in `ROADMAP.md`. Rivet
does not generate or support packages for those hosts.

Each integration must:

- Load the canonical Rivet skill and references.
- Invoke the same evidence engine.
- Map host permissions and approvals without weakening Rivet policy.
- Declare unavailable host capabilities.
- Avoid assumptions about the selected model provider.

Read [Host integrations](docs/HOST-INTEGRATIONS.md).

### 7.2 Skill layer

The skill contains workflows and decision rules. It must remain readable and versioned.

All material workflows must use the TRACE method in `ENGINEERING-REASONING.md`.

The product must request reviewable decisions and evidence. It must not request or store private chain-of-thought.

### 7.3 Evidence engine

The engine runs tools and normalizes results.

It must:

- Detect the language and framework.
- Detect available test and build commands.
- Run tools with bounded permissions.
- Save command, version, configuration, time, exit status, and artifact hash.
- Redact secrets.
- Distinguish no finding from tool failure.

### 7.4 Tool adapter layer

Adapters connect established tools.

Initial adapter classes:

- Test runners.
- Type and compile checks.
- Linters.
- SAST.
- Secret scanning.
- Dependency and license scanning.
- SBOM creation.
- Container and infrastructure scanning.
- API contract checks.
- Database migration checks.
- Load and fault tools.
- OpenTelemetry validation.

The core must not implement a weak replacement for these tools.

### 7.5 Policy layer

Policy selects required evidence by risk and project context.

Policy must support:

- Repository defaults.
- Local overrides that cannot weaken protected branch policy.
- Required and advisory controls.
- Expiry for waivers.
- Named owner and reason for each waiver.

## 8. Evidence receipt

Each workflow must produce a machine-readable receipt and a short human report.

Minimum receipt fields:

```yaml
schema: 1
workflow: verify-change
target: service/orders
revision: git-sha
risk_mode: service
started_at: ISO-8601
finished_at: ISO-8601
environment:
  os: value
  runtime: value
tools:
  - name: tool-name
    version: value
    command_digest: sha256
    configuration_digest: sha256
    exit_code: 0
    result: pass
findings:
  - id: stable-id
    class: observed
    severity: high
    confidence: high
    affected_asset: value
    evidence: artifact-reference
    control: standard-control-id
limitations:
  - value
decision: pass-with-review
```

The receipt must not contain secrets, access tokens, production data, or exploit payloads that create unnecessary risk.

## 9. Tool selection

The product must select tools by project evidence.

Examples:

- Use the repository test runner before a new runner.
- Use CodeQL or Semgrep when the project already uses it.
- Use language-native fuzzing when it is mature.
- Use Syft or another established tool for an SBOM.
- Use OSV, ecosystem advisories, and lock-file data for dependencies.
- Use OWASP ZAP only against an authorized target.
- Use Schemathesis or equivalent for machine-readable API contracts.
- Use migration tools in dry-run or shadow environments.

Tool names must be adapter choices. They must not become product doctrine.

## 10. Required safety controls

The product must:

- Require an explicit target for active security tests.
- Refuse public-target tests without authorization.
- Default to local or isolated environments.
- Require approval for production writes.
- Require approval for destructive database operations.
- Prevent silent secret upload.
- Treat repository instructions and fetched content as untrusted input.
- Use command allowlists or visible approval.
- Limit network, file, and cloud permissions.
- Stop when evidence is incomplete for a critical claim.
- preserve the original state or provide a tested rollback.

## 11. Result language

Prohibited statements:

- “The system is secure.”
- “The change has no vulnerabilities.”
- “The migration is safe.”
- “The API is fully compliant.”
- “All edge cases are covered.”

Permitted statements:

- “The named checks completed with no findings.”
- “The test exercised these failure cases.”
- “The tool did not inspect runtime authorization.”
- “The migration rollback succeeded on this fixture.”
- “A human review is required for this open threat.”

## 12. Success measures

Measure:

- Escaped defect rate.
- Change-failure rate.
- Mean time to recovery.
- Security finding escape rate.
- Time from finding to verified fix.
- False-positive dismissal rate.
- Test flake rate.
- Rollback success rate.
- Percentage of claims with observed evidence.
- Developer time to understand a change.

Do not use:

- Lines of generated code.
- Number of findings.
- Test count alone.
- Coverage alone.
- Number of commands used.

