# Host Conformance

## Scope

This document records observed native host checks.

Package conformance remains automated by:

```sh
npm run test:hosts
```

Native checks can use model tokens and host credentials. They are not part of the default test command.

## 2026-10-25

### Codex

Host version: `codex-cli 0.164.0`

Model provider: Amazon Bedrock

Installation:

```text
.agents/skills/rivet/
```

Test:

- Started an ephemeral Codex execution.
- Used a read-only sandbox.
- Invoked `$rivet`.
- Requested the first instruction below the Rivet heading.

Observed result:

```text
RIVET_NATIVE_OK
Make backend changes that have explicit invariants and observed evidence.
```

Result: native skill discovery passed.

Not tested:

- Approval mapping.
- Workspace-write behavior.
- Host hooks.
- Session resume.
- Tool execution from the packaged skill.

### Claude Code

Host version: `2.1.146`

Installation:

```text
.claude/skills/rivet/
```

Test:

- Started a non-persistent print execution.
- Enabled only the native `Skill` tool.
- Applied a USD 0.10 maximum budget.
- Invoked `/rivet`.
- Requested the first instruction below the Rivet heading.

Observed result:

```text
RIVET_NATIVE_OK
Make backend changes that have explicit invariants and observed evidence.
```

Result: native skill discovery passed.

Not tested:

- Approval mapping.
- Edit and shell permission behavior.
- Host hooks.
- Session resume.
- Tool execution from the packaged skill.

### Cursor

Result: unavailable.

The Cursor command-line tool was not installed in the test environment. Package-level conformance passed, but native runtime behavior was not tested.

## Interpretation

These checks prove that the tested Codex and Claude Code versions can load the canonical Rivet skill from their project discovery paths.

They do not prove full host conformance. Approval, sandbox, hook, session, and tool-execution tests remain open.
