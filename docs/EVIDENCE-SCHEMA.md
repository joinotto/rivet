# Evidence Schema

## Evidence classes

- `observed`: A tool or runtime produced the evidence.
- `derived`: Rivet calculated the result from observed inputs.
- `inferred`: An agent formed a conclusion from incomplete evidence.
- `unknown`: Rivet has insufficient evidence.

## Decision values

- `pass`
- `fail`
- `incomplete`
- `insufficient-evidence`

## Rule

A tool failure must not produce `pass`.

A dependency scanner can use a nonzero exit status to report findings. Rivet must parse the documented machine-readable output before it classifies that result. Invalid or missing output is a tool failure, not a vulnerability finding and not a pass.

## Receipt requirements

A receipt must include:

- Schema version.
- Workflow.
- Target.
- Revision when available.
- Start and finish time.
- Adapter identity.
- Tool version when the tool reports one.
- Command digest.
- Configuration digest when the adapter has a configuration source.
- Exit status.
- Result class.
- Redacted output.
- Limitations.
- Decision.

Receipts must not contain credentials or unnecessary personal data.

## Human and CI output

The human summary must be derived from the same in-memory receipt as the JSON artifact. It must not recalculate the decision.

CI annotations must contain check identity and result. They must not contain raw tool output, credentials, or untrusted multiline text.

