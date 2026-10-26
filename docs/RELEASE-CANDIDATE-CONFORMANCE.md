# Release-candidate workflow conformance

Observed on 2026-10-26.

## Scope

This record covers the manual `Unsigned release candidate` GitHub Actions
workflow. It does not cover signing, approval, publication, installation, or a
public release.

## Observed run

- Workflow run: `40381304029`.
- Job: `121777949353`.
- Source revision: `8b84eb85c933a3f850fbc0a8142764c6b5ce1a08`.
- Version: `0.1.0`.
- Trigger: `workflow_dispatch`.
- Result: pass.

The workflow:

1. Checked out the selected full revision.
2. required the revision to be an ancestor of `origin/main`.
3. built the unsigned candidate from a clean worktree.
4. verified its inventory, archives, checksums, SBOM, and provenance.
5. retained the candidate as a 14-day workflow artifact.

## Independent artifact verification

The retained artifact was downloaded after the run and verified again with:

```sh
npm run verify:release-candidate -- \
  --input ARTIFACT_DIRECTORY \
  --version 0.1.0 \
  --revision 8b84eb85c933a3f850fbc0a8142764c6b5ce1a08
```

Result: pass with four host archives and no faults.

Observed archive digests:

| Host | SHA-256 |
| --- | --- |
| Claude Code | `05084eaaeef8f1809a04b3266940bc40d50438f5d24a83e6d107f7cc50335a3e` |
| Codex | `76afbd33878311d2eb97a5034a1ddaf159cee190187ae02113bf9afd4ba6328f` |
| Cursor | `5101774c7cff99cbb66a0ae9c8b2c2de8249386c0aed3c3de25b7598fbfe515d` |
| Portable | `a2d9d2bccdfd643bce2e12cdfab369825cc1d73825135da32824828875a0fd40` |

## Decision

The workflow can build, verify, and retain an unsigned candidate for an exact
default-branch revision.

This result does not authenticate a publisher. It does not satisfy the Rivet
signing, independent-review, support, or publication requirements. The
artifact is not an official release.
