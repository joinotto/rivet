# Roadmap

## Initial scope

Support Codex and Claude Code only. Keep one canonical backend-engineering
skill and generate each host package from it.

Current capabilities include repository inspection, TRACE change records,
database guidance, selected verification, security evidence, reliability,
performance, and recoverable project-local installation.

## First supported release

- Validate fresh-project installation, upgrade, removal, and recovery.
- Keep first-use commands and compatibility documentation tested.
- Evaluate the product on representative backend projects with real users.
- Resolve release-blocking security and compatibility findings.
- Publish verified, signed artifacts with source revision, license, notices,
  software bill of materials, provenance, and required independent approvals.

The current version is a development preview, not a supported production
release. Follow `RELEASING.md` before publication.

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
