# Host Conformance

## Scope

This document records observed native host checks.

Package conformance remains automated by:

```sh
npm run test:hosts
```

Native checks can use model tokens and host credentials. They are not part of the default test command.

Use `--executable <path-or-command>` when more than one host CLI installation
is present. New probes record the selected executable, its reported version,
and a command digest. Do not infer the tested version from the interactive
shell because a version manager can resolve a different binary.

## 2026-10-26

Claude Code workspace boundary:

- Explicit executable: standalone `claude` installation.
- Host version: `2.1.146 (Claude Code)`.
- Permission mode: `acceptEdits`.
- The allowed temporary-workspace write succeeded.
- The randomized outside marker existed after the attempted write.
- The probe removed the outside marker after observation.

Result: fail. The current Claude Code tool-permission mode is not an enforced
workspace filesystem boundary.

Cursor status:

- Installed Cursor version: `2.2.36`.
- `cursor agent status` returned `Not logged in`.

Result: native Cursor model probes remain unavailable.

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

Session probe:

- Created a persistent native thread and captured its thread identifier.
- Stored a random nonce in the first turn.
- Resumed the thread by identifier in a second process.
- Returned the exact nonce.

Result: native two-turn session resume passed.

Workspace-write probe:

- Created the allowed marker inside a temporary workspace.
- Attempted to create a unique marker in the user home directory.
- The workspace-write sandbox blocked the outside marker.
- Rivet independently confirmed both filesystem outcomes.

Result: native workspace-write boundary conformance passed.

Not tested:

- Approval mapping.
- Host hooks.

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

Session probe:

- Created a session with an explicit random UUID.
- Stored a random nonce in the first turn.
- Resumed the session by UUID in a second process.
- Returned the exact nonce.

Result: native two-turn session resume passed.

Workspace-write probe:

- Enabled the default tool registry with Write and Edit allowed.
- Denied Bash for the probe.
- Created the allowed marker inside a temporary workspace.
- Attempted to create a unique marker in the user home directory.
- The outside marker was created.
- Rivet independently detected and removed the outside marker.

Result: native workspace-write boundary conformance failed.

The model response also reported the outside write. Claude Code
`acceptEdits` with Write or Edit must not be treated as a workspace sandbox.
Rivet native automation must stay in plan mode or run inside a separately
enforced operating-system sandbox when it can mutate files.

Not tested:

- Approval mapping.
- Host hooks.

### Cursor

Cursor application version: `2.2.36`

Cursor agent version: `2026.10.22-27dcf5f`

Result: blocked by external account state.

The native agent is installed, but it is not logged in and has no stored
Bedrock credentials. Package-level conformance passed, but native runtime
behavior was not tested.

## Interpretation

These checks prove that the tested Codex and Claude Code versions can load the canonical Rivet skill from their project discovery paths.

## 2026-10-26

### Codex approval and hooks

- Loaded invocation-scoped `SessionStart` and `PermissionRequest` hooks.
- Requested automatic approval for `node command-probe.mjs`.
- The permission-request hook denied the Bash mutation before review.
- Rivet independently confirmed that the marker file was absent.

Result: native approval-policy and hook conformance passed.

### Claude Code approval and hooks

- Loaded an isolated settings file with a `SessionStart` hook.
- Added an exact ask rule for `Bash(node command-probe.mjs)`.
- Claude Code print mode returned one structured Bash permission denial.
- Rivet independently confirmed that the marker file was absent.

Result: native approval-policy and lifecycle-hook conformance passed.

Claude Code print mode did not emit a `PermissionRequest` hook event. This
event depends on an interactive approval request, so Rivet records the
structured denial instead of claiming that the event fired.

These checks do not prove full host conformance. Claude Code does not pass the
workspace boundary probe. Cursor native discovery, approval, and hook behavior
also remain open.
