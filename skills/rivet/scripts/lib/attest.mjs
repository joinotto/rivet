export function cosignPlan({
  artifact,
  bundle,
  identity,
  issuer,
}) {
  const sign = {
    schema: 1,
    id: "cosign-sign-blob",
    executable: "cosign",
    args: ["sign-blob", "--yes", "--bundle", bundle, artifact],
    kind: "evidence-signing",
    network: true,
    external_identity: true,
  };
  const verify = {
    schema: 1,
    id: "cosign-verify-blob",
    executable: "cosign",
    args: [
      "verify-blob",
      "--bundle",
      bundle,
      "--certificate-identity",
      identity || "<required-identity>",
      "--certificate-oidc-issuer",
      issuer || "<required-issuer>",
      artifact,
    ],
    kind: "evidence-verification",
    network: false,
  };
  return {
    schema: 1,
    workflow: "sigstore-attestation",
    artifact,
    bundle,
    sign,
    verify,
    limitations: [
      "A plan is not a signature or verification result.",
      "Keyless signing uses an external identity provider and transparency service.",
      "Verification must constrain the expected certificate identity and issuer.",
    ],
  };
}

export function cosignResult(action, result) {
  if (result.error?.code === "ENOENT") {
    return {
      result: "unavailable",
      exit_code: null,
      reason: "Cosign is not installed.",
    };
  }
  if (result.error) {
    return {
      result: "tool-failure",
      exit_code: null,
      reason: result.error.message || "Cosign failed to start.",
    };
  }
  return {
    result: result.status === 0 ? (action === "sign" ? "signed" : "verified") : "fail",
    exit_code: result.status,
    reason: result.status === 0 ? null : "Cosign returned a nonzero exit status.",
  };
}
