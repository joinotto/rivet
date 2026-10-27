# Getting started

Status: unsigned development preview. Version `0.1.1` is for isolated
evaluation, not supported production use.

Rivet supports project-local installations for Codex and Claude Code. It does
not install a model, change a model provider, modify host permissions, or
request credentials. Existing Amazon Bedrock configuration remains yours.

Use a maintained Node.js 22 runtime for deployment. Node.js 16 compatibility
remains covered by the test suite; compatibility is not a runtime support
promise from the Node.js project.

## Fast path: no manual clone

Run in your backend project:

```sh
npx --ignore-scripts https://github.com/joinotto/rivet/archive/refs/tags/v0.1.1.tar.gz install --host codex --project .
```

For Claude Code, use `--host claude-code`. Add `--dry-run` to preview project
changes. Then start your coding tool and invoke `$rivet` or `/rivet`.
Review downloaded source before execution. See
[installation and recovery](INSTALLATION.md) for cache, source-identity, and
upgrade limitations. Do not use the unrelated npm package named `rivet`.

## 1. Obtain the source for checkout-based use

Review the source revision before installation. For a signed release, verify
the publisher identity and artifact digests according to the
[release policy](RELEASING.md).
The current candidates are unsigned. A local receipt does not authenticate
their publisher.

```sh
git clone https://github.com/joinotto/rivet.git
cd rivet
git rev-parse HEAD
npm test
```

The runtime and installer have no third-party runtime dependencies.

## 2. Preview and install

Replace `/absolute/path/backend` with an existing project directory.

For Codex:

```sh
node scripts/install-skill.mjs install \
  --host codex --project /absolute/path/backend --dry-run
node scripts/install-skill.mjs install \
  --host codex --project /absolute/path/backend
```

For Claude Code:

```sh
node scripts/install-skill.mjs install \
  --host claude-code --project /absolute/path/backend --dry-run
node scripts/install-skill.mjs install \
  --host claude-code --project /absolute/path/backend
```

The discovery paths are:

| Host | Installed skill |
| --- | --- |
| Codex | `.agents/skills/rivet/SKILL.md` |
| Claude Code | `.claude/skills/rivet/SKILL.md` |

The installer refuses symbolic-link discovery paths and existing unmanaged
skills. It does not overwrite `AGENTS.md`, `CLAUDE.md`, host settings, or other
skills. Run each host installation separately when a project uses both.

Generated host packages include the same standalone installer. From an
extracted package, replace `scripts/install-skill.mjs` with `install.mjs`.
Use the host named by that package. Keep the extracted package for maintenance.

## 3. Invoke the skill

Start the coding tool in the backend project.

In Codex:

```text
$rivet Inspect this backend project. Show the detected checks and their
commands. Do not execute checks or change files until I approve them.
```

In Claude Code:

```text
/rivet Inspect this backend project. Show the detected checks and their
commands. Do not execute checks or change files until I approve them.
```

If the skill does not appear, restart the host. Check for another installed
skill with the same name. Host settings can disable discovery.

Current discovery and invocation sources:

- [Official Codex skills documentation](https://learn.chatgpt.com/docs/build-skills)
- [Official Claude Code skills documentation](https://code.claude.com/docs/en/skills)

## 4. Inspect and verify

You can run the deterministic helper without a model session.

From the backend project, use the installed Codex path:

```sh
node .agents/skills/rivet/scripts/rivet-evidence.mjs inspect
node .agents/skills/rivet/scripts/rivet-evidence.mjs doctor
node .agents/skills/rivet/scripts/rivet-evidence.mjs verify --dry-run
```

For Claude Code, use `.claude/skills/rivet/scripts/rivet-evidence.mjs`.

Warning: repository checks can execute arbitrary project code. Review the
command, working directory, credentials, network use, and output before you
approve execution.

If the preview lists a check named `test`, run it explicitly:

```sh
node .agents/skills/rivet/scripts/rivet-evidence.mjs verify --checks test --json
```

Use the actual check identifiers from your project. A missing or failed tool
is not a pass. Read the evidence limitations before using a result.

For automated Claude Code writes, use the declared external-sandbox profile
in [host integrations](HOST-INTEGRATIONS.md). Claude Code permissions alone
are not an operating-system filesystem boundary. The tested macOS launcher
uses deprecated `sandbox-exec`; do not assume support on other systems.

## 5. Maintain or remove

See [installation and recovery](INSTALLATION.md) for status, upgrade, removal,
backups, lock recovery, and modified-file handling.

Rivet remains a development preview until the real-project pilot, qualified
security review, signatures, and independent release approvals pass. See
[release policy](RELEASING.md).
