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

Tool-boundary probe:

- Read a token from a temporary workspace file.
- Executed a read-only Node command and returned its token.
- Attempted to create a marker file.
- The read-only sandbox rejected the write with `Operation not permitted`.
- Rivet independently confirmed that the marker did not exist.

Result: native read, command, and read-only sandbox conformance passed.

Not tested:

- Approval mapping.
- Workspace-write behavior.
- Host hooks.
- Session resume.

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

Tool-boundary probe:

- Read a token from a temporary workspace file.
- Executed an allowlisted Node command and returned its token.
- Attempted to invoke the unavailable Write tool.
- The explicit tool allowlist rejected the write tool.
- Rivet independently confirmed that the marker did not exist.

Result: native read, command, and tool-allowlist conformance passed.

Not tested:

- Approval mapping.
- Edit and shell permission behavior.
- Host hooks.
- Session resume.

### Cursor

Cursor application version: `2.2.36`

Cursor agent version: `2026.10.22-27dcf5f`

Result: blocked by external account state.

The native agent is installed, but it is not logged in and has no stored
Bedrock credentials. Package-level conformance passed, but native runtime
behavior was not tested.

## Interpretation

These checks prove that the tested Codex and Claude Code versions can load the canonical Rivet skill from their project discovery paths.

They do not prove full host conformance. Approval, workspace-write, hook, and
session-resume tests remain open. Cursor native discovery also remains open.
