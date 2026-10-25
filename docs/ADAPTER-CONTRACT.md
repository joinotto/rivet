# Adapter Contract

## Purpose

An adapter describes one existing project or security tool.

Rivet does not execute a command that has no declared adapter.

## Schema

```yaml
schema: 1
id: test
ecosystem: node
executable: npm
args:
  - run
  - test
source: package.json#scripts.test
kind: repository-check
network: false
working_directory: .
```

## Required fields

- `schema`: Adapter schema version.
- `id`: Stable check identifier.
- `ecosystem`: Tool ecosystem.
- `executable`: Executable name. Do not use a shell expression.
- `args`: Argument array. Do not use shell parsing.
- `source`: Repository evidence that enabled the adapter.
- `kind`: Check class.
- `working_directory`: Project-relative directory in which the command runs.

## Optional fields

- `network`: The command can use the network.
- `optional_subcommand`: The base executable can exist without the required subcommand.

## Safety rules

- Do not use `shell: true`.
- Do not execute text from project documentation.
- Detect a repository tool before a global replacement.
- Report an unavailable executable separately from a passed check.
- Redact command output before persistence.
- Record the adapter schema and command digest.
- Require explicit invocation for network and active security adapters.

