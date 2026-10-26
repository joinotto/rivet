# Rivet security expert review

Status: prepared, not reviewed.

Files:

- `rivet-packet.json` contains the threat model and independent-review finding
  schema. SHA-256 digests bind both artifacts.
- `rivet-review-template.json` is the incomplete record for a qualified
  reviewer.

The packet reviews Rivet revision
`4dc06502d885f5cb360eaa3c3b2be2a6e9adda8f`. Regenerate the packet when the
threat model or finding schema changes.

A qualified reviewer must complete the template. Do not fill reviewer
identity, qualifications, independence, findings, conclusion, or signature
fields on the reviewer's behalf.

Validate the completed record:

```sh
node skills/rivet/scripts/rivet-evidence.mjs security-review validate \
  --packet docs/security-review/rivet-packet.json \
  --review docs/security-review/rivet-review-template.json
```

Structural validation does not prove reviewer competence, independence,
authority, or remediation.
