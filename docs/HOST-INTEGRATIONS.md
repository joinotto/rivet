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

## Supported hosts

### Codex

Use the Codex skill discovery location and optional agent metadata.

The integration can expose Rivet scripts through the local shell and can use Codex approval and sandbox controls. It must not assume an OpenAI model provider. Codex can run Rivet while the user selects another configured model provider.

### Claude Code

Use a project or user skill directory supported by Claude Code.

Keep Claude-specific hooks, allowed tools, and metadata outside the canonical skill. Do not weaken Rivet approval rules through a host permission setting.

### Cursor

Use Cursor project skills for reusable Rivet instructions.

Keep Cursor rules or compatibility files as generated wrappers. Do not duplicate the engineering guidance in a separate Cursor source.

### Other hosts

Add a host when it can:

- Load project instructions or skills.
- Execute local commands with visible permissions.
- Return command status and output.
- Preserve project context.
- Support explicit approval for consequential actions.

If a host lacks one capability, the integration must report the limitation. It must not simulate evidence that the host cannot collect.

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

## Distribution

The first distribution target is a repository-local installation.

Planned packages:

```text
dist/
├── codex/
├── claude-code/
├── cursor/
└── portable/
```

These directories are build outputs. The source remains in `skills/rivet/`.
