# Security Work

Security is a life-cycle property. A clean scan is not proof of security.

## Before editing

Identify:

- Asset.
- Actor.
- Entry point.
- Trust boundary.
- Required permission.
- Abuse case.
- Sensitive data.
- Audit and recovery needs.

Use deny by default. Verify authorization at the operation and object boundary.

## Evidence

Use established project tools for:

- Static analysis.
- Secret scanning.
- Dependency and license analysis.
- Software bill of materials.
- Container and infrastructure scanning.
- Dynamic testing against an authorized target.

Do not replace these tools with agent opinion.

## Vulnerability priority

Do not prioritize from CVSS alone.

Consider:

- Known exploitation.
- Exploitation probability.
- Runtime reachability.
- Internet or trust-boundary exposure.
- Asset and data criticality.
- Existing mitigation.
- Fix availability.
- Fix and rollout risk.

For each finding, state detection source, affected asset, reachability, impact, confidence, remediation, verification, and limitation.

## Required safety

- Do not test a public or production target without explicit authorization.
- Default active tests to local or isolated systems.
- Do not run credential, persistence, destructive, or denial-of-service actions.
- Do not expose secrets in commands, logs, or receipts.
- Require a diff and independent verification for a critical fix.

For authentication or authorization changes, test positive, negative, cross-tenant, lifecycle, and audit behavior.

