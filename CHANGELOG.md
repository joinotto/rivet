# Changelog

This file records user-visible changes. The initial version `0.1.0` is
designated as an unsigned development prerelease, not a production release.

## 0.1.1 — Development prerelease (2026-10-27)

### Added

- Clone-free, version-pinned GitHub archive installation through `npx` for
  Codex and Claude Code, using the same managed installer and recovery rules.
- Minimal npm packaging allowlist and a `rivet` executable. No lifecycle hooks,
  global install, project dependency, or third-party runtime dependency.
- Offline packed-distribution lifecycle tests on both supported Node.js versions.

### Changed

- Quick-start guides lead with the direct command, not a repository clone.
- Downloaded source cannot inherit the Git identity of a containing worktree.
  Archive receipts explicitly record unknown Git provenance.
- Release tests obtain the version from package metadata.
- This update remains an unsigned evaluation prerelease. Production gates
  are unchanged. The unrelated unscoped npm package is not this Rivet.

## 0.1.0 — Development prerelease (2026-10-27)

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
- Release builds preserve existing output directories. Generic verification
  does not execute active-target contract checks without the explicit workflow.
- Secret redaction handles quoted JSON values. Requested unreadable files
  produce incomplete scan evidence instead of a passing result.
- Secret scans do not traverse symbolic directories or read files through
  symbolic parents outside the project.
- Database guidance distinguishes cursor ordering from commit visibility.
  Test guidance separates runner startup failures from assertion results.
- Empty dependency findings are not treated as clean evidence when the
  dependency tool fails.
- Evidence outputs resolve existing ancestors before directory creation and
  use regular-file descriptors that do not follow final symbolic links.
- Candidate verification rejects malformed archive sizes, duplicate entries,
  and trailing archive data.
- PR reports refuse symbolic output directories and files. Deleted paths
  remain in impact analysis but are not scanned as existing file content.
- File-list inputs must resolve inside the selected project.
- The ASD-STE100-aligned writing profile is optional and risk-based.
  Its checker does not certify compliance.
- Experimental development helpers and implementation records are excluded
  from the public source tree and host packages.
- Detailed guides and project policies are organized under `docs/`, with a
  categorized index. Only essential repository Markdown files remain at root.
- Publication remains subject to real-project pilots, qualified review,
  authenticated artifacts, and independent approvals.
- An explicit evaluation exception permits this unsigned development
  prerelease. Production requirements remain unchanged.
