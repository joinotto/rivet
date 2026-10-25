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

## Receipt requirements

A receipt must include:

- Schema version.
- Workflow.
- Target.
- Revision when available.
- Start and finish time.
- Adapter identity.
- Command digest.
- Exit status.
- Result class.
- Redacted output.
- Limitations.
- Decision.

Receipts must not contain credentials or unnecessary personal data.

