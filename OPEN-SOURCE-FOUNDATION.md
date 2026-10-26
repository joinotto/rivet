# Open-Source Foundation

## 1. License

Recommended license: Apache License 2.0.

Reasons:

- Permissive commercial and private use.
- Explicit patent grant.
- Familiarity in infrastructure and developer tools.
- Compatibility with the proposed Impeccable model.

Use another license only after legal review.

## 2. Required repository files

Maintain these files before the first public release:

- `LICENSE`
- `NOTICE`
- `README.md`
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `GOVERNANCE.md`
- `MAINTAINERS.md`
- `SUPPORT.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `RELEASING.md`
- `THREAT-MODEL.md`
- `docs/architecture.md`

## 3. Contribution model

Use:

- Public issues and design discussions.
- Small pull requests.
- Required tests.
- Required security review for sensitive modules.
- Developer Certificate of Origin sign-off unless legal counsel requires a CLA.
- A documented decision and appeal process.
- A published maintainer succession process.

Do not:

- Give one company an undocumented veto.
- Accept generated code without a named human contributor.
- merge security-sensitive code on one approval.
- require assignment of copyright without a clear need.

## 4. Source and license hygiene

Use SPDX identifiers in source files and package metadata.

Use REUSE practices to make copyright and license status machine-readable.

Source: [REUSE Specification](https://reuse.software/spec/)

## 5. Release security

Required:

- Protected branches.
- Required review.
- Short-lived CI identity.
- Reproducible or hermetic build where practical.
- Generated SBOM.
- Signed artifacts.
- Provenance attestation.
- Two-person release approval for sensitive binaries.
- Documented key compromise and revocation procedure.

Current branch settings and limitations are recorded in
`docs/BRANCH-PROTECTION.md`.

Current repository security settings and limitations are recorded in
`docs/SECURITY-BASELINE.md`.

Use SLSA as the incremental provenance model.

Source: [SLSA specification](https://slsa.dev/spec/)

## 6. Dependency policy

Each dependency must have:

- Purpose.
- Direct owner.
- Version policy.
- License check.
- Security-advisory source.
- Maintenance and release activity review.
- Removal plan for abandoned critical dependencies.

Do not reject a dependency only because it has few maintainers. Evaluate context and criticality.

## 7. Vulnerability disclosure

`SECURITY.md` must contain:

- Supported versions.
- Private report channel.
- Required report information.
- Response targets.
- Safe-harbor statement where legal counsel approves it.
- Coordinated disclosure process.
- Credit policy.
- CVE policy.

Do not require a public issue for a new vulnerability.

## 8. Project security baseline

Adopt:

- OpenSSF Best Practices.
- OpenSSF Scorecard.
- Code review.
- automated dependency updates with review.
- secret scanning.
- static analysis.
- fuzzing for parsers and trust-boundary code.
- branch protection.
- minimal workflow permissions.

Source: [OpenSSF projects](https://openssf.org/projects/)

## 9. Versioning

Use Semantic Versioning for stable interfaces.

Version these items:

- CLI contract.
- Evidence schema.
- Adapter API.
- Policy schema.
- Skill commands.
- Rule identifiers.

Provide migrations for project context and config.

Never silently change the meaning of a security rule.

## 10. Documentation

Documentation is part of the tested product.

For each release:

- Test commands.
- Test examples.
- Verify links.
- Verify configuration examples.
- Check that the documented output matches actual output.
- Record incompatible changes.

## 11. Governance stages

### Stage 1: Founder-led

- Public decisions.
- Named maintainers.
- Two reviewers for security-sensitive work.

### Stage 2: Multi-maintainer

- Maintainer nomination rules.
- Technical steering group.
- Conflict-of-interest policy.

### Stage 3: Foundation-ready

- Neutral trademark and assets policy.
- Independent release authority.
- Published budget and sponsorship policy.
- Transfer plan if the original company stops maintenance.

## 12. Trademark

Do not use the name “Impeccable” for a separate product without permission from its owner.

Use a temporary project name until trademark and collaboration terms are clear.

