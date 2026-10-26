# Releasing

Status: no public release has occurred.

## Release candidate

Build an unsigned local candidate only from a clean committed revision:

```sh
npm run package:release-candidate -- \
  --version 0.1.0 \
  --revision "$(git rev-parse HEAD)" \
  --output dist/release
```

The builder creates deterministic uncompressed host archives, SHA-256 sums, a
CycloneDX SBOM, unsigned source-bound provenance, and a manifest. CI builds the
candidate twice and requires byte-identical output.

The candidate is not a release. Do not publish it until the signing,
independent approval, support, verification, and publication requirements in
this document are complete.

## Release authority

A named maintainer prepares a release. Security-sensitive binaries or
distribution changes require two qualified approvals when two reviewers are
available. Do not release when an applicable required approval is missing.

## Release inputs

Before a release:

1. Select the version according to Semantic Versioning.
2. Review incompatible CLI, schema, adapter, skill-command, and rule changes.
3. Update `CHANGELOG.md`.
4. Run the complete CI workflow on the release revision.
5. Validate generated host packages from the canonical skill source.
6. Generate the software bill of materials.
7. Record dependency, license, security, and open-evidence review.
8. Build release artifacts from a clean revision.
9. Sign artifacts and record provenance.
10. Obtain the required approvals.

## Required evidence

Retain:

- Source revision and release version.
- CI run identifiers.
- Build environment and commands.
- Artifact digests.
- Host-package conformance result.
- Software bill of materials and source revision.
- Signature and verification result.
- Provenance statement.
- Reviewer identities and approvals.
- Known limitations and deferred risks.

## Publication

Publish immutable artifacts and release notes. Do not move an existing version
tag. Do not replace a published artifact under the same version.

## Compromise and revocation

If a signing identity, token, workflow, or release artifact can be
compromised:

1. Stop publication.
2. Revoke or disable the affected credential or identity.
3. Preserve evidence and identify affected versions.
4. Notify users through the release and security channels.
5. Publish corrected artifacts under a new version.
6. Record the incident, recovery, and verification evidence.

The first public release must add the exact build, SBOM, provenance, signing,
verification, and publication commands used by its distribution mechanism.
