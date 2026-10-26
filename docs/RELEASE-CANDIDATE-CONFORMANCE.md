# Release-candidate workflow conformance

Observed on 2026-10-26.

## Scope

This record covers the manual `Unsigned release candidate` GitHub Actions
workflow. It does not cover signing, approval, publication, installation, or a
public release.

The runs below predate the 2026-10-26 decision to support only Codex and Claude
Code. Their four-archive inventories are historical evidence. Current
candidate generation and verification require exactly two host archives.

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

## Historical milestone candidate

The workflow was repeated after the pull-request verification milestone was
implemented and enforced:

- Workflow run: `40393437523`.
- Job: `121820119790`.
- Source revision: `8b9a5d8c4a6f2941245687773187f96599e7e13d`.
- Version: `0.1.0`.
- Trigger: `workflow_dispatch`.
- Workflow result: pass.
- Independent downloaded-artifact verification: pass.
- Artifact identifier: `12685426928`.
- GitHub artifact digest:
  `sha256:8c0cf49b11ba16ac20987caa2d1d20015d89bd630e6b2701f418f4f9087a2a96`.
- Candidate manifest digest:
  `sha256:5500ca7602e9cb40678b7233f742381acbd291d0f07e1f9673251110da3f6957`.

Observed archive digests:

| Host | SHA-256 |
| --- | --- |
| Claude Code | `95e2bec1acee2d44b6fe0bc209864517cf58ed3a8505f6df440cce20c41c5adb` |
| Codex | `8c958fc164c5646ee643a127b4765cdc83039c8e1d9a9bfc2d24b29de138f156` |
| Cursor | `fd0ac88f07d211760dd3c952c43c208274e1ff0c6511c3182dd480c9279e3a0c` |
| Portable | `93759b6a2c54b98c72f8106a2af72a15b9c9b67c2c03f3d8e52fa5ca175d1c49` |

Each archive contains `rivet/scripts/rivet-pr-verify.mjs` and
`rivet/scripts/rivet-evidence.mjs`.

## SLSA predicate candidate

The workflow was repeated after the candidate adopted the in-toto Statement v1
and SLSA provenance v1 predicate:

- Workflow run: `40400844333`.
- Job: `121845955253`.
- Source revision: `5107f5e7e7fadbfcca243f17d09b6e578b2399c9`.
- Version: `0.1.0`.
- Workflow result: pass.
- Independent downloaded-artifact verification: pass with four archives and
  no faults.
- Artifact identifier: `12688916467`.
- GitHub artifact digest:
  `sha256:17b0fec3ec6b372743dc6967b361e959f49f04b081a16f0677c50288d56e0d63`.
- Candidate manifest digest:
  `sha256:4b16409c255115be80735e52f4fca1065aa335ddd7072f2913d91db515544ad4`.
- Provenance statement digest:
  `sha256:c1ad2537d35fd00888a954e898a01578e44926e29e16269282ed5c0a7949b6cf`.
- CycloneDX SBOM digest:
  `sha256:ec3c612ecf05fb0a4835dece29989e9c29731cff130f00dccd5041643a009173`.

The downloaded statement recorded the exact source revision, four archive
subjects, the SBOM and checksum file as byproducts, and `unsigned: true`.

## Decision

The workflow can build, verify, and retain an unsigned candidate for an exact
default-branch revision.

This result does not authenticate a publisher. It does not satisfy the Rivet
signing, independent-review, support, or publication requirements. The
artifact is not an official release.
