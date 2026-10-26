# Rivet release build type

> This document uses an ASD-STE100-aligned technical writing style. It is not a
> certified ASD-STE100 document.

## v1

The build creates the four Rivet host-package archives from the canonical
`skills/rivet/` source. It also creates `SHA256SUMS`, a CycloneDX SBOM, an
unsigned SLSA provenance statement, and a candidate manifest.

External parameters:

- `version`: the candidate semantic version.
- `revision`: the full source Git commit identifier.

Internal parameters record the Node.js version, operating system, processor
architecture, clean-source state, archive format, timestamp, file mode, owner,
and group normalization.

The resolved dependency is the Rivet Git repository at the selected commit.
The subjects are the four host-package archives. The SBOM and `SHA256SUMS` are
recorded as byproducts.

## Local builder

`scripts/build-release-candidate.mjs` is a user-controlled local builder. Its
identifier describes this builder class. It is not a trusted build-platform
identity.

The statement records the builder script digest and a deterministic invocation
identifier. It has no signature. It does not satisfy a SLSA build level and
does not authenticate the source, invocation, builder, or artifacts.

A public release requires an authenticated build service, a separately
selected identity policy, signature verification, retained CI evidence, and
independent approval.
