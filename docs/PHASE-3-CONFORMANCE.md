# Phase 3 conformance

Observed on 2026-10-26.

Status: incomplete.

## Expert review

Evidence:

- `docs/security-review/rivet-packet.json`
- `docs/security-review/rivet-review-template.json`
- `skills/rivet/scripts/lib/security-review.mjs`

Rivet has a digest-bound packet for the product threat model and independent
finding schema. The reviewer record requires identity, role, organization,
qualifications, independence, conflicts, reviewed scope, conclusion, findings,
dispositions, residual risks, limitations, and signature identity.

The reviewer template is intentionally incomplete. No qualified security
expert has completed the record.

Result: fail.

Required evidence:

- A qualified reviewer completes the threat-model and finding-schema review.
- Rivet validates the completed record against the prepared packet.
- Maintainers record dispositions and remediation evidence for each finding.

## Known vulnerable fixtures

Evidence:

- `fixtures/reference-systems/kev-dependency/`
- `fixtures/reference-systems/expected-findings.json`
- `skills/rivet/scripts/lib/evaluate.mjs`
- `test/rivet-evidence.test.mjs`

The published Log4Shell fixture contains the expected
`CVE-2021-44228` seed. The deterministic evaluation reports the known
exploited vulnerability with no missed or unexpected seed labels. The larger
published fixture set reports eight of eight expected findings.

Result: pass for the published fixtures.

Limitation: published fixtures can be overfit and do not represent unknown
production dependency graphs or configurations.

## Non-reachable components

Evidence:

- `docs/EVIDENCE-SCHEMA.md`
- `skills/rivet/scripts/lib/security-evidence.mjs`
- `test/rivet-evidence.test.mjs`

A `not-reachable` result requires a source revision, observation time, named
method, and evidence artifacts. Rivet changes an unsupported
`not-reachable` claim to `unknown`. Unknown reachability does not suppress a
vulnerability.

Result: pass.

Limitation: reachability can change with configuration, deployment, runtime
paths, reflection, generated code, or later revisions.

## Vulnerability priority

Evidence:

- `skills/rivet/scripts/lib/security-evidence.mjs`
- `skills/rivet/references/security.md`
- `test/rivet-evidence.test.mjs`

Rivet preserves dated CISA KEV and FIRST EPSS evidence. Each vulnerability
records known exploitation, exploitation probability, runtime reachability,
exposure, asset criticality, mitigation strength, fix availability, and fix
risk. Factors without evidence remain `unknown`.

The fixture explains why `CVE-2021-44228` has stronger priority evidence than
an unlisted fixture identifier: it appears in the supplied KEV snapshot and
has a high supplied EPSS probability. Rivet does not convert EPSS to severity
or calculate a universal priority score while material factors are unknown.

Result: pass.

Limitation: KEV and EPSS do not replace business impact, exposure,
reachability, remediation-risk, and asset-criticality evidence.

## Secure-development deliverables

Evidence:

- `skills/rivet/scripts/lib/security-evidence.mjs`
- `skills/rivet/scripts/lib/threat-model.mjs`
- `skills/rivet/scripts/lib/waiver.mjs`
- `skills/rivet/scripts/lib/attest.mjs`
- `docs/NATIVE-SAST-CONFORMANCE.md`
- `docs/NATIVE-SIGNATURE-CONFORMANCE.md`

Rivet preserves source-supplied CWE and OWASP ASVS mappings, validates
revision-bound reachability, validates owned and expiring waivers, and
supports signed evidence plans and observed native signature verification.

Result: implemented for the published scope.

Limitations:

- A source mapping does not prove compliance.
- Structural waiver validation does not prove adequate risk acceptance.
- Signature verification does not prove that the signed result is correct.

## Decision

Three Phase 3 exit criteria pass for their published scope. Phase 3 remains in
progress because the required qualified security-expert review has not
occurred.
