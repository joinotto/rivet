# Security and Evidence Model

## 1. Security objective

The product must reduce software risk without creating a more powerful unsafe agent.

## 2. Threat actors

Consider:

- A malicious repository.
- A compromised dependency.
- A malicious issue, document, or web page.
- An accidental developer action.
- A compromised agent tool.
- A user who tests a target without authority.
- An attacker who puts secrets in logs or findings.
- A maintainer account compromise.

## 3. Main product threats

### Prompt injection

Repository text can tell the agent to ignore policy, expose secrets, or run commands.

Controls:

- Treat repository and web content as data.
- Give policy instructions higher authority.
- Display requested side effects.
- Use explicit command and target approval.
- Do not execute commands found in documents automatically.

### Excessive tool permission

An agent can have shell, cloud, database, or network access that the workflow does not need.

Controls:

- Use least privilege.
- Use read-only access by default.
- Use short-lived credentials.
- Separate development, test, and production identities.
- Require approval for writes and network expansion.
- Do not treat a model-facing file-tool allowlist as an operating-system
  filesystem boundary.

### Unsafe active testing

DAST, fuzzing, load, and exploit reproduction can damage a target.

Controls:

- Require authorization and target classification.
- Default to local or isolated targets.
- Rate-limit active tools.
- Prohibit denial-of-service behavior by default.
- Stop on unexpected external scope.

### False security claims

An agent can interpret a clean scan as complete security.

Controls:

- Report tool coverage and failure.
- Name checks that did not run.
- Separate observed, derived, inferred, and unknown.
- Require human approval for critical release decisions.

### Secret leakage

Commands, logs, fixtures, traces, and reports can contain secrets.

Controls:

- Scan inputs and outputs.
- Redact values before persistence.
- Do not send repository data to a remote model without the configured policy.
- Keep raw artifacts local by default.
- Encrypt sensitive evidence at rest.

### Malicious fix

An automatic fix can weaken a control or insert a backdoor.

Controls:

- Require a diff.
- Run independent verification.
- Check new dependencies and permissions.
- Prevent the same agent context from being the only reviewer for a critical fix.

## 4. Vulnerability finding schema

Each finding must contain:

- Stable identifier.
- Detection source and version.
- Affected component and version.
- Affected asset.
- Technical condition.
- Reachability status.
- Exposure status.
- CISA KEV status.
- EPSS score and retrieval date.
- CVSS data when available.
- CWE or control mapping.
- Exploit evidence or reproduction status.
- Business impact.
- Existing mitigation.
- Recommended action.
- Fix availability.
- Fix and rollout risk.
- Verification step.
- Confidence.
- Limitations.

## 5. Severity and priority

Severity and priority are different.

- **Severity** describes possible technical impact.
- **Priority** describes when this organization must act.

Example:

A critical library CVE can have low immediate priority when the affected function is not present or reachable. A medium vulnerability can have urgent priority when CISA lists it as exploited, the service is public, and the affected asset contains sensitive data.

## 6. Verification requirements

### Security fix

Required:

- Reproduction or applicability evidence.
- A regression test or deterministic check.
- A second scan.
- Review of bypass variants.
- Dependency and permission diff.
- Rollout and monitoring plan.

### Authentication or authorization change

Required:

- Positive and negative tests.
- Cross-tenant tests.
- Role and object matrix.
- Default-deny verification.
- Session and token lifecycle review.
- Audit-event verification.

### Data migration

Required:

- Representative fixture.
- Dry run.
- Row or object count reconciliation.
- Constraint checks.
- Restart and resume behavior.
- rollback or forward recovery.

### Distributed workflow

Required:

- Duplicate request.
- Lost response.
- Timeout.
- Partial completion.
- Out-of-order event.
- Delayed event.
- dependency outage.
- recovery after restart.

## 7. Waivers

A waiver must include:

- Finding or control.
- Technical reason.
- Business reason.
- Compensating control.
- Owner.
- Approval.
- Creation date.
- Expiry date.
- Review trigger.

Permanent silent ignores are not permitted for high-risk findings.

## 8. Security standards map

Use these standards as references:

- NIST SSDF for the secure development life cycle.
- CISA Secure by Design for producer responsibility and secure defaults.
- OWASP ASVS for web application controls.
- OWASP API Security Top 10 for API-specific review.
- CWE for weakness classification.
- CISA KEV and FIRST EPSS for priority.
- OWASP SCVS for component controls.
- SLSA for build provenance.
- SPDX or CycloneDX for SBOM data.
- OpenSSF Scorecard and Best Practices for project hygiene.

The product must state the version of each standard.

## 9. Prohibited functions in early releases

- Autonomous public penetration testing.
- Credential attacks.
- Persistence.
- Malware generation.
- Secret extraction.
- Destructive production tests.
- Unbounded load generation.
- Automatic security certification.
- Automatic acceptance of a critical risk.

