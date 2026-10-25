# Native SAST conformance

## GitHub CodeQL

Observed on 2026-10-25:

- Rivet revision: `115b90b883133ce558afb0b80abb565f198138e4`.
- GitHub Actions run: `40184331751`.
- CodeQL bundle: `2.27.3`.
- CodeQL action: `9b3254085494b55a0f7c4c2b3d2d52cc712ce370`.
- Result: pass.

The run:

1. Analyzed the intentional command-injection fixture.
2. Produced SARIF 2.1.0.
3. Copied the artifact into the repository evidence boundary.
4. Normalized it with the Rivet `security --sarif` workflow.
5. Found `js/command-line-injection`.

This result proves the pinned fixture and workflow worked for the stated
revision and tool version. It does not prove that CodeQL finds every security
defect or that later action revisions remain conformant.
