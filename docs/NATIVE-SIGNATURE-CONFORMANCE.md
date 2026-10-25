# Native signature conformance

## Cosign

Observed on 2026-10-25:

- Rivet revision: `422c30d358d6ff6a31f5fe0179027b035a5b1080`.
- GitHub Actions run: `40191534933`.
- Cosign version: `3.1.4`.
- Cosign installer action: `6f9f17788090df1f26f669e9d70d6ae9567deba6`.
- Result: pass.

The run:

1. Generated an ephemeral local key pair.
2. Signed the CycloneDX fixture with an offline Cosign signing configuration.
3. Wrote the signature and verification material to a Sigstore bundle.
4. Verified the bundle and artifact through the Rivet `sbom` workflow.
5. Required Rivet to report a valid signature and a verified decision.

This result proves artifact integrity against the ephemeral public key for the
stated revision and tool version. The workflow does not publish to Rekor and
does not prove a public signer identity. Use Rivet `sigstore` mode when the
policy requires identity-constrained and transparency-log verification.
