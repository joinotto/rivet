# Native signature fixture

The workflow generates an ephemeral Cosign key pair, signs `bom.json`, and
verifies the bundle through Rivet.

The private key exists only inside the workflow job. The fixture does not use a
production identity or publish to a transparency log.
