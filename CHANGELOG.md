# Changelog

This file records user-visible changes. Rivet has no public release yet.
The source package version is `0.1.0`.

## Unreleased

### Added

- Backend engineering guidance for reasoning, database design, testing,
  security, distributed systems, and production operations.
- Repository inspection, change-impact analysis, selected check execution,
  and structured evidence receipts.
- Coverage, mutation, property, contract, and repeated-test evidence analysis.
- Security artifact normalization, secret redaction, dependency-risk analysis,
  threat-model review packets, and explicit authorization controls.
- Read-only PostgreSQL migration and query-plan inspection.
- Retry, idempotency, observability, performance, staged-release, and
  incident evidence workflows.
- Project-local installation, status, upgrade, and recoverable removal.
  Modified and unmanaged installations are not overwritten.
- Standalone installers, source identity, license, and notice in host packages.
- Getting-started instructions, recovery guidance, and a revised README header.
- Reproducible unsigned candidate archives, checksums, software bill of
  materials, provenance, and offline verification.
- Automated behavioral, installation, packaging, parser-fuzz, dependency,
  license, and source-analysis checks.

### Changed

- Initial support is limited to Codex and Claude Code. Other coding tools
  are deferred.
- Installation preserves project files and model-provider settings.
- Installed skills retain license and notice files. Packaging refuses ignored
  canonical files, local state, unsafe links, and unrelated replacement targets.
- Corpus merges check combined byte and physical file limits before writing.
- The ASD-STE100-aligned writing profile is optional and risk-based.
  Its checker does not certify compliance.
- Experimental development helpers and implementation records are excluded
  from the public source tree and host packages.
- Detailed guides and project policies are organized under `docs/`, with a
  categorized index. Only essential repository Markdown files remain at root.
- Publication remains subject to real-project pilots, qualified review,
  authenticated artifacts, and independent approvals.
