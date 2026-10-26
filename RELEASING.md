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

The output directory must resolve inside the project. The builder rejects
symbolic link traversal outside that boundary and does not remove an outside
directory when `--force` is set.

The candidate is not a release. Do not publish it until the signing,
independent approval, support, verification, and publication requirements in
this document are complete.

Verify a received candidate before review or signing:

```sh
npm run verify:release-candidate -- \
  --input dist/release \
  --version 0.1.0 \
  --revision COMMIT_ID
```

The verifier fails when the inventory, digests, normalized archive structure,
host metadata, SBOM binding, or provenance binding is inconsistent. It does not
verify a publisher identity or authorize publication.

The verifier reads each retained artifact once through a bounded, no-follow
file descriptor. It rejects a symbolic-link candidate root and non-file
inventory entries.

An authorized maintainer can run the `Unsigned release candidate` workflow
with a full commit identifier from `main` and the matching package version.
The workflow has read-only repository permission. It builds and verifies the
candidate, then retains it as a 14-day workflow artifact. It does not create a
tag, GitHub release, package, signature, or publication.

The first observed native run and independent artifact verification are in
`docs/RELEASE-CANDIDATE-CONFORMANCE.md`.

Prepare a revision-bound release evidence draft:

```sh
npm run release:evidence -- prepare \
  --candidate dist/release \
  --output dist/release-evidence.json \
  --preparer MAINTAINER_IDENTITY
```

The draft automatically binds the verified host packages, SBOM, and
provenance from the candidate. It stays on hold until every other required
gate has pass status and an artifact digest. Required gates also cover CI,
dependencies, license, security, compatibility, changelog, support, and
signature verification. The record requires two distinct qualified
independent approvals. Validate the completed record with:

```sh
npm run release:evidence -- validate \
  --candidate dist/release \
  --record dist/release-evidence.json \
  --evidence-root dist/release-evidence
```

The validator opens each gate and approval artifact from its declared
candidate or evidence scope and recomputes its SHA-256 digest. It rejects
absolute paths, parent traversal, symbolic links, non-files, missing files,
and changed content. The strongest result is `ready-for-publication-review`.
It does not authorize or create a release.

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

The OSV workflow runs a full dependency scan on each push to `main`. Use that
exact-revision run for the dependency gate. Pull-request diff scans do not
replace the release-revision full scan.

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
