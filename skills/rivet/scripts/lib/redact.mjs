import crypto from "crypto";

const PATTERNS = [
  /\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(api[_-]?key|token|password|secret)\s*[:=]\s*["']?[^\s"',}]+/gi,
  /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function quotedSecretAssignment() {
  return /((["']?)\b(?:api[_-]?key|token|password|secret)\2\s*[:=]\s*)(["'])((?:\\.|(?!\3)[^\\])*)\3/gi;
}

export function redact(value) {
  let output = String(value || "");
  output = output.replace(quotedSecretAssignment(), (match, prefix, keyQuote, valueQuote) =>
    `${prefix}${valueQuote}[REDACTED]${valueQuote}`,
  );
  for (const pattern of PATTERNS) {
    output = output.replace(pattern, (match, label) =>
      label ? `${label} [REDACTED]` : "[REDACTED]",
    );
  }
  return output;
}

export function fingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex")
    .slice(0, 12);
}

