# Security Policy

> This document uses an ASD-STE100-aligned technical writing style. It is not a certified ASD-STE100 document.

## Supported versions

The project is in an early development stage. Only the current main branch receives security fixes.

## Report a vulnerability

Do not open a public issue for a new vulnerability.

Use [GitHub private vulnerability reporting](https://github.com/joinotto/rivet/security/advisories/new):

1. Open the repository **Security** page.
2. Select **Advisories**.
3. Select **Report a vulnerability**.

This route creates a private discussion with the repository maintainers.

Include:

- Affected revision or version.
- Affected component.
- Technical condition.
- Reproduction steps.
- Potential effect.
- Required access.
- Suggested mitigation, if available.

Do not include active credentials, personal data, or destructive payloads.

## Response

The maintainers use these response targets:

- Confirm receipt in three business days.
- Complete the initial assessment in seven business days.
- Give a status update at least every 14 days while the report is open.

These targets are goals, not service-level guarantees. A complex report can
require more time. The maintainers will tell the reporter when a target cannot
be met.

The maintainers must:

1. Confirm receipt.
2. Assess scope and severity.
3. Define a remediation and disclosure plan.
4. Test the fix.
5. Publish an advisory when applicable.

## Coordinated disclosure

The reporter and the maintainers must agree on a disclosure plan.

The default target is public disclosure within 90 days after the maintainers
confirm the vulnerability. The parties can use a shorter period when a fix is
ready or active exploitation creates an urgent risk. They can extend the
period by mutual agreement.

Do not publish technical details before the advisory or fix is ready. If an
urgent safety risk requires earlier notice, coordinate the notice with the
maintainers and affected parties.

## Credit

The project gives credit when the reporter requests it and follows this policy.
The reporter can use a name, organization, handle, or anonymous credit.

The project will confirm the credit text before publication. The project can
withhold credit when the report includes harmful or unauthorized testing.

## CVE policy

The maintainers will assess whether a confirmed vulnerability qualifies for a
CVE identifier. When it qualifies, they will request or coordinate the
identifier through the private GitHub Security Advisory.

Not every report qualifies for a CVE identifier. The advisory will explain the
decision when it is useful to affected users.

## Testing authorization

You may test a local copy that you control.

You must have explicit authorization before you test a hosted project service or another user's system.

Do not perform denial-of-service, credential, persistence, destructive, or data-extraction tests.

## Safe-harbor status

The project has not adopted a legal safe-harbor promise. The testing rules in
this policy describe the authorized project scope. They are not legal advice,
a waiver, or authorization to test a system that you do not control.

The maintainers will not publish a broader safe-harbor statement until
qualified legal counsel approves it.

