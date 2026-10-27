# Installation and recovery

This procedure uses an ASD-STE100-aligned style. It is not a certified
ASD-STE100 document.

## Scope

Install only in an explicit project directory. The installer supports Codex
and Claude Code. The installer itself does not install globally, download code, change model
providers, change permissions, or execute repository checks.

The source is the reviewed Rivet checkout, a downloaded source package, or an extracted host package.
Its files are bounded and read without following symbolic links.
Installation retains `LICENSE` and `NOTICE` in the managed skill directory.
Canonical source that contains ignored files, local state, or credential-file
paths is refused.

## Direct command without a clone

Use a maintained Node.js 22 runtime with npm. In an existing backend project:

```sh
npx --ignore-scripts @ottoai/rivet@0.1.3 install --host codex --project .
```

Use `--host claude-code` for Claude Code. Add `--dry-run` to preview project
changes. Replace `install` with `status`, `upgrade`, or `remove` for the same
managed lifecycle. For an upgrade, select and review the desired published version.
Run each host command separately when a project uses both hosts.

npm downloads code to its cache. It does not add a project dependency.
`--ignore-scripts` disables package lifecycle hooks. It does not prevent the
explicit installer from running. Review downloaded code before execution.
An npm confirmation prompt can appear on first use; approve only the expected
`@ottoai/rivet` package and version. This distribution has no install hooks or
third-party dependencies.

Do not run `npx rivet`. The unscoped npm package is unrelated to this project.
The public package is `@ottoai/rivet`. Version `0.1.3` is the initial stable
tooling release under the [maintainer exception](RELEASING.md).
The normal production requirements remain incomplete and unchanged.
An unreleased checkout can precede publication; confirm the selected version
with `npm view @ottoai/rivet@0.1.3 version`.
To select the current stable distribution channel:

```sh
npx --ignore-scripts @ottoai/rivet@latest install --host codex --project .
```

`latest` can change. For repeatable use, select an exact
published version as in the first command.
The workflow requires authenticated GitHub Actions provenance. Verify the
registry signature, provenance, artifact digest, and source binding for the
selected published version. These checks do not sign the separate GitHub host
archives or prove production safety. See [releasing](RELEASING.md) for verification
and release gates.

The earlier npm preview remains available as `@ottoai/rivet@0.1.2-preview.1`.
Use `@ottoai/rivet@next` only to select the preview channel.

The existing unsigned GitHub preview is still available:

```sh
npx --ignore-scripts https://github.com/joinotto/rivet/archive/refs/tags/v0.1.1.tar.gz install --host codex --project .
```

Both distributions use the same installer, preservation rules, and backups.

A downloaded npm package or source archive has no Git checkout metadata. Its receipt records the package
version, `source_revision: null`, and `source_state: unknown`. This is deliberate:
a tag URL and a local inventory are not a publisher signature. Review the tag's
commit on GitHub or use a verified host archive for source-bound metadata.
GitHub tags can be moved; a full commit archive URL can pin the source more
precisely, but it still does not authenticate the publisher.

For offline use, retain a downloaded, reviewed host archive and invoke its
standalone `install.mjs`. The checkout commands below remain supported.

## Status

```sh
node scripts/install-skill.mjs status \
  --host codex --project /absolute/path/backend
```

Use `--host claude-code` for the other host.

`installed` means the skill matches its recorded file and directory inventory.
`modified` means that inventory changed. `unmanaged` means a valid receipt is
absent or invalid. `missing` means the discovery target is absent.

The receipt records the host, source version, source revision, source state,
and SHA-256 inventory. It is local ownership evidence, not a digital signature
or authorization to execute the skill.

## Upgrade

Warning: preserve your changes before an upgrade. Rivet refuses a modified
or unmanaged installation. There is no force-overwrite option.

Obtain and review the new source or package. Preview the operation:

```sh
node scripts/install-skill.mjs upgrade \
  --host codex --project /absolute/path/backend --dry-run
```

If the preview matches your intent, run the command without `--dry-run`.

Rivet stages the new files before replacement. It moves the previous skill
to `.rivet/installation-backups/<host>/rivet-<unique-id>`. The result reports
the exact backup path. It then moves the staged skill into the discovery path.

If replacement fails, Rivet attempts to restore the previous installation.
If restoration fails or another target appears, Rivet preserves the backup
and reports its path. Inspect both locations before further action.

## Remove

```sh
node scripts/install-skill.mjs remove \
  --host codex --project /absolute/path/backend --dry-run
```

If the preview matches your intent, run the command without `--dry-run`.

Removal moves the managed skill to the same backup directory. It does not
delete its contents or change another skill. An already absent installation
is unchanged.

Keep backups until the rollback period ends. Remove a backup only after you
inspect its exact path and confirm that it contains no required user changes.
The installer does not automatically delete backups.

## Recover a backup

1. Read the exact backup path from the operation result.
2. Run status for the destination.
3. If another managed installation exists, remove it through Rivet to retain
   a separate backup.
4. If a modified or unmanaged target exists, preserve it manually in a new
   location. Do not overwrite it.
5. Confirm that the discovery target is absent.
6. Move the selected backup into that exact discovery target.
7. Run status. Confirm `installed` before use.

Recovery requires both locations to support a filesystem rename. A
cross-filesystem error leaves the original installation unchanged.

## Interrupted operation

Rivet serializes mutations with `.rivet-install.lock` in the host's `skills`
directory. A normal success or caught failure removes its own lock.

If a process terminates abruptly:

1. Read the lock's process identifier and machine name.
2. Confirm that no installation process is active.
3. Inspect the discovery target, retained backups, and `.rivet-stage-*`
   directories in that exact host skills directory.
4. Preserve any complete installation before recovery.
5. Move the stale lock to a separate record. Do not move an active lock.
6. Recover an intact backup when required. Run status before retrying.

The installer does not automatically guess whether a lock is stale. A staged
directory is not a completed installation. Hosts must not use it as Rivet.

## Limitations

- This is a local file-management tool, not an operating-system sandbox.
- The lock coordinates Rivet installers, not arbitrary concurrent editors.
- Do not run it while an untrusted process can replace project directories.
- Dirty source is recorded as dirty. It is not a production release.
- Exit status `2` means a refused operation or modified/unmanaged status.
- A dry-run does not create directories, locks, files, or backups.
