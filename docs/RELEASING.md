# Releasing

Status: no public release has occurred.

## Candidate

Build only from a clean committed revision:

```sh
npm run package:release-candidate -- \
  --version 0.1.0 \
  --revision "$(git rev-parse HEAD)" \
  --output dist/release
```

The builder creates exactly two host archives: Codex and Claude Code. Each
contains the canonical skill, standalone installer, source-bound host
metadata, Apache-2.0 license, and project notice.

It also creates SHA-256 sums, a CycloneDX software bill of materials, an
unsigned in-toto Statement with the SLSA v1 provenance predicate, and a
manifest. The build uses normalized timestamps, owners, and file modes.

See [release build type](RELEASE-BUILD-TYPE.md).

## Verify

Verify a received candidate before review or signing:

```sh
npm run verify:release-candidate -- \
  --input dist/release \
  --version 0.1.0 \
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

Do not publish while a required condition is incomplete. Use immutable
versioned artifacts. Do not move a published version tag or replace its files.

## Compromise and revocation

If a signing identity, token, workflow, or artifact is compromised:

1. Stop publication.
2. Revoke or disable the affected identity.
3. Preserve evidence and identify affected versions.
4. Notify affected users through the release and security channels.
5. Publish corrected artifacts under a new version.
6. Record the incident and verified recovery.
