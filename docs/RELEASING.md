# Releasing

Status: version `0.1.1` is designated for an unsigned development prerelease.
No supported production release has occurred.

## Development prerelease exception

The maintainer approved an explicit evaluation exception on 2026-10-27 for
version `0.1.0`, and requested publication of the clone-free installation update
as version `0.1.1`. This exception permits publication of a verified unsigned
candidate as a development prerelease. It does not approve production use.

The prerelease must:

- Use the exact tested source revision and verified artifact digests.
- Be marked as a GitHub prerelease and not the latest stable release.
- Include only the two host archives, checksums, SBOM, provenance, and manifest.
- State that the artifacts and provenance are unsigned.
- State that qualified review, real-user feedback, authenticated signing, and
  independent production approvals remain incomplete.
- Exclude private development files, pilot reports, and reviewer drafts.

This exception applies only to the designated prerelease. It does not waive
the production requirements below. Preserve the prerelease tag and its assets.
Use a new version for a subsequent release.

## Candidate

Build only from a clean committed revision:

```sh
npm run package:release-candidate -- \
  --version 0.1.1 \
  --revision "$(git rev-parse HEAD)" \
  --output dist/release
```

The builder creates exactly two host archives: Codex and Claude Code. Each
contains the canonical skill, standalone installer, source-bound host
metadata, Apache-2.0 license, and project notice.

It also creates SHA-256 sums, a CycloneDX software bill of materials, an
unsigned in-toto Statement with the SLSA v1 provenance predicate, and a
manifest. The build uses normalized timestamps, owners, and file modes.

Use a new output directory for each build. The builder does not delete an
existing output directory, even with `--force`. Source validation occurs
before the builder creates the output directory.

See [release build type](RELEASE-BUILD-TYPE.md).

## Verify

Verify a received candidate before review or signing:

```sh
npm run verify:release-candidate -- \
  --input dist/release \
  --version 0.1.1 \
  --revision COMMIT_ID
```

The verifier checks inventory, digests, archive structure, host identity,
source revision, software bill of materials, and provenance binding.
It rejects symbolic-link roots and non-file artifacts.

Warning: the current candidates are unsigned. Successful candidate
verification does not authenticate a publisher or authorize publication.

## Publication requirements

The responsible maintainer must retain:

- Exact source revision, version, build commands, and artifact digests.
- Passing CI, complete dependency scan, license review, and compatibility tests.
- Fresh-project installation, upgrade, removal, and recovery evidence.
- Representative real-project pilot results for both hosts, including missed
  defects, false positives, usability, and recovery.
- Qualified security review and dispositions of release-blocking findings.
- Software bill of materials and authenticated build provenance.
- Artifact signatures, a selected signing identity and trust policy, and
  successful independent signature verification.
- Two distinct qualified independent release approvals.
- Release notes, supported profiles, known limitations, and recovery guidance.

Do not fabricate reviewer identities, qualifications, conclusions, signatures,
or pilot feedback. An agent review does not replace a required human approval.
Keep sensitive review material and customer information private.

Do not publish a production release while a required condition is incomplete.
Use immutable
versioned artifacts. Do not move a published version tag or replace its files.

## Compromise and revocation

If a signing identity, token, workflow, or artifact is compromised:

1. Stop publication.
2. Revoke or disable the affected identity.
3. Preserve evidence and identify affected versions.
4. Notify affected users through the release and security channels.
5. Publish corrected artifacts under a new version.
6. Record the incident and verified recovery.
