# Secure Development Policy

> This document uses an ASD-STE100-aligned technical writing style. It is not a
> certified ASD-STE100 document.

## Credentials

Do not store a production credential in the repository, source, fixture,
example, log, or evidence record.

Use the hosting platform or deployment system secret store. Give a workflow
only the credential and permission that its task requires. Do not give a
secret to a pull-request workflow that runs untrusted code.

Limit credential access to named maintainers or services with an operational
need. Review access when a role changes and at least before each release.

Rotate a credential:

- When exposure is suspected or confirmed.
- When an access holder leaves the responsible role.
- When the provider or project policy requires rotation.
- Before reuse after an incident.

Revoke the old credential. Verify that the old value no longer works. Record
the affected scope and recovery evidence without recording the secret.

## Dependency and license findings

Run software composition analysis on each pull request.

Block a change when it introduces:

- A known exploited vulnerability.
- An applicable critical or high severity vulnerability.
- A dependency that the project identifies as malicious or compromised.
- A license that is incompatible with Apache License 2.0 distribution.
- A dependency without an identifiable source or required license terms.

Triage moderate and low severity findings before release. Record
applicability, reachability, exposure, fix availability, and remediation risk.
An unreviewed finding blocks release.

An exception must identify the component, finding, source revision,
non-exploitability or acceptance evidence, owner, approval, and expiry. Keep
the exception next to the affected manifest when the scanner supports this.
Do not suppress a finding only to pass CI.

The intentionally vulnerable manifests in `fixtures/reference-systems` are
test inputs. They must not enter a build, package, example application, or
runtime deployment.

## Static analysis findings

Run static analysis on each pull request.

Block a change when CodeQL reports an unresolved error, critical, or high
severity security weakness. Triage other security findings before release.

A suppression must identify the rule, location, source revision, reason,
owner, approval, and expiry. Use `not exploitable` only when evidence shows
the relevant data flow, precondition, or control. Recheck the suppression when
the affected code changes.

## Release gate

Before release:

1. Run dependency, license, secret, and static-analysis checks on the release
   revision.
2. Resolve each blocking finding or approve a documented exception.
3. Confirm that each exception is current and applies to the release revision.
4. Record the tools, versions, configuration, findings, and disposition.

Do not release when a required scan did not complete.
