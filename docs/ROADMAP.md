# Roadmap

## Initial scope

Support Codex and Claude Code only. Keep one canonical backend-engineering
skill and generate each host package from it.

Current capabilities include repository inspection, TRACE change records,
database guidance, selected verification, security evidence, reliability,
performance, and recoverable project-local installation.

## Initial stable tooling release

Version `0.1.3` targets the `latest` npm channel under a one-time maintainer
exception. This does not complete the production gates or waive them for
subsequent releases. Publication requires the protected workflow and deployment
approval. See [the exception and normal requirements](RELEASING.md).

## First production-approved release

- Provide clone-free, version-pinned installation for both active hosts.
  GitHub `npx` distribution is available in the unsigned `0.1.1` preview.
  The npm command is available as `@ottoai/rivet@0.1.2-preview.1` and `@next`.
  Package-specific trusted publishing, a deployment approval gate, authenticated
  provenance, and public installation tests are complete for this preview.

- Validate fresh-project installation, upgrade, removal, and recovery.
- Keep first-use commands and compatibility documentation tested.
- Evaluate the product on representative backend projects with real users.
- Resolve release-blocking security and compatibility findings.
- Publish verified, signed artifacts with source revision, license, notices,
  software bill of materials, provenance, and required independent approvals.

The initial stable tooling release is not a production-approved release.
Follow the [release policy](RELEASING.md) before claiming that status.

## Subsequent improvements

- Improve test selection and evidence quality from observed user workflows.
- Extend database and tool adapters when a verified use case requires them.
- Improve host compatibility within the declared permission boundaries.
- Keep false positives, missing evidence, and recovery limitations visible.

## Future coding tools

Cursor and other coding tools are deferred. There is no active package or
support for them.

A new host requires a separate scope decision, demonstrated user demand,
native discovery and execution checks, session and approval checks, declared
filesystem boundaries, and tested installation and recovery.
