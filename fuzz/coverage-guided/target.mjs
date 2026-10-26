import {
  normalizeSarifDocument,
  normalizeSbomDocument,
  normalizeTrivyDocument,
} from "../../skills/rivet/scripts/lib/security-evidence.mjs";

const expectedErrors = new Set([
  "The artifact is not SARIF 2.1.0.",
  "The artifact is not a supported Trivy JSON report.",
  "The artifact is not supported CycloneDX or SPDX JSON.",
]);

const normalizers = [
  (document) => normalizeSarifDocument(document),
  (document) => normalizeTrivyDocument(document),
  (document) => normalizeSbomDocument(document, "fuzz-revision"),
];

export function fuzz(input) {
  if (input.length > 1024 * 1024) return;
  let document;
  try {
    document = JSON.parse(input.toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }

  for (const normalize of normalizers) {
    try {
      const first = JSON.stringify(normalize(document));
      const second = JSON.stringify(normalize(document));
      if (first !== second) {
        throw new Error("The normalizer returned a non-deterministic result.");
      }
      if (Buffer.byteLength(first) > 1024 * 1024) {
        throw new Error("The normalizer returned more than 1 MiB.");
      }
    } catch (error) {
      if (!expectedErrors.has(error?.message)) throw error;
    }
  }
}
