# Host Integrations

## Purpose

Rivet is independent of one coding agent.

The portable core contains:

- The canonical `SKILL.md`.
- Domain references.
- The TRACE protocol.
- Evidence schemas.
- Deterministic scripts.
- Adapter contracts.
- Behavioral tests.

A host integration only connects this core to an agent product.

## Initial supported hosts

The initial distribution supports Codex and Claude Code only. Future host
expansion is recorded in the [roadmap](ROADMAP.md).

### Codex

Use the Codex skill discovery location and optional agent metadata.

The integration can expose Rivet scripts through the local shell and can use Codex approval and sandbox controls. It must not assume an OpenAI model provider. Codex can run Rivet while the user selects another configured model provider.

### Claude Code

Use a project or user skill directory supported by Claude Code.

Keep Claude-specific hooks, allowed tools, and metadata outside the canonical skill. Do not weaken Rivet approval rules through a host permission setting.

Do not treat Claude Code `acceptEdits` as a workspace filesystem boundary. A
native conformance probe created a file outside the selected workspace. Use
plan mode for read-only Rivet automation. Put mutating automation inside an
independently enforced operating-system sandbox and require explicit approval.

On macOS, `scripts/claude-macos-sandbox.mjs` is an optional compatibility
launcher. It permits writes only below the current real workspace path. Set
`RIVET_CLAUDE_EXECUTABLE` to an explicit Claude Code executable when command
resolution is not sufficient.

Apple marks the underlying `sandbox-exec` command as deprecated. This profile
is not portable and is not a long-term product boundary. Do not silently fall
back to unsandboxed execution when the launcher is unavailable.

## Integration contract

Each host integration must declare:

- Host name and tested version.
- Installation scope.
- Skill discovery path.
- Script invocation method.
- Working-directory behavior.
- Permission and approval behavior.
- Environment-variable handling.
- Output and truncation behavior.
- Session-context behavior.
- Unsupported Rivet capabilities.

## Canonical-source rule

Maintain Rivet guidance in one source tree.

Generate or link host packages from that tree. A host wrapper can contain:

- Discovery metadata.
- A short bootstrap instruction.
- Host-native commands.
- Capability declarations.

A wrapper must not contain a fork of the database, testing, security, or systems guidance.

## Capability negotiation

Before a workflow, the integration determines:

- Whether local execution is available.
- Whether network use requires approval.
- Whether the host can request an approval.
- Whether output can be persisted safely.
- Whether an independent review context is available.

Rivet selects a reduced workflow when a capability is unavailable. It records the missing capability as a limitation.

## Conformance tests

Every supported host must pass the same fixtures:

- Load the canonical skill.
- Detect a repository.
- Preview commands without executing them.
- Run an allowed local check.
- Distinguish a missing tool from a pass.
- Redact a seeded secret.
- Block an output path outside the repository.
- Produce a schema-valid evidence receipt.

Host-specific tests can add approval, sandbox, hook, and session cases.

Run package-level conformance:

```sh
npm run test:hosts
```

This test generates every package and runs the same inspection, verification, and redaction fixture through each packaged runner. It does not test native host approvals, sandboxes, hooks, or session behavior.

Package conformance does not certify host versions or operating-system
boundaries. Use the declared permission and platform limitations above.

## Distribution

The first distribution target is a repository-local installation.

Use [getting started](getting-started.md) and
[installation and recovery](INSTALLATION.md). Every generated host package
includes a standalone `install.mjs` and source-bound `rivet-host.json`.

Generated packages:

```text
dist/
├── codex/
└── claude-code/
```

These directories are build outputs. The source remains in `skills/rivet/`.
