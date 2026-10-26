# Rivet Threat Model

## Assets

- User source code.
- Credentials and environment data.
- Evidence receipts.
- Tool and policy configuration.
- Release artifacts.
- Maintainer identities.

## Trust boundaries

- Agent to local command runner.
- Repository content to agent instructions.
- Local process to network service.
- Rivet adapter to external tool.
- CI workflow to release registry.
- Distributed package to project-local skill installation.

## Principal threats

### Malicious repository instruction

A repository can contain text that requests unsafe commands or secret disclosure.

Controls:

- Treat repository text as data.
- Use declared adapters.
- Do not execute commands from documentation.
- Require approval for external effects.

### Command injection

Untrusted text can enter a shell command.

Controls:

- Use an executable and argument array.
- Do not use shell evaluation.
- Do not create adapters from arbitrary project text.

### Secret disclosure

A tool can print a credential in its output.

Controls:

- Redact output before persistence.
- Store evidence files with restricted permissions.
- Do not print matched secret values.

### False pass

A missing or failed tool can appear as a successful verification.

Controls:

- Use separate pass, fail, unavailable, and insufficient states.
- Record exit status.
- State evidence limitations.

### Unsafe active test

A security or load tool can damage an unauthorized target.

Controls:

- Require explicit target authorization.
- Default to local systems.
- Keep active adapters out of automatic hooks.

### Compromised release

An attacker can modify a distributed skill or runner.

Implemented candidate controls:

- Deterministic host archives.
- Revision-bound CycloneDX SBOM.
- Unsigned in-toto Statement with the SLSA v1 provenance predicate.
- Candidate manifest and independent verification.

Required public-release controls:

- Signed release artifacts.
- Authenticated build provenance.
- Two-person release approval.

### Unsafe installation or recovery

An installation can replace user changes, follow a link outside the intended
project, lose the previous version, or misrepresent package identity.

Controls:

- Require an explicit project and one of the two supported hosts.
- Refuse symbolic-link discovery and backup paths.
- Bound source files and read regular files through no-follow descriptors.
- Record file and directory inventories with SHA-256 digests.
- Refuse modified or unmanaged targets. Do not offer force overwrite.
- Serialize Rivet mutations with an exclusive lock.
- Stage replacement before moving the existing installation.
- Retain the previous installation outside the skill discovery directory.
- Attempt restoration after a replacement failure.
- Treat local receipts as ownership records, not publisher signatures.

Verification:

- Fresh-project workflow and preservation tests for both hosts.
- Edited files, extra directories, invalid receipts, link paths, lock conflicts,
  and replacement-failure tests.
- Standalone installer tests through generated host packages.

## Residual risks

- Heuristic risk classification can miss business-critical code.
- Redaction patterns cannot identify all secrets.
- Existing repository scripts can perform unsafe actions.
- Third-party tools can have vulnerabilities.
- An agent can form an incorrect inference from correct evidence.
- The installation lock does not coordinate arbitrary concurrent editors.
- Local checks do not protect against a hostile process that can replace
  filesystem paths during the operation.

