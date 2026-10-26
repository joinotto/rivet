# Contributing

> This document uses an ASD-STE100-aligned technical writing style. It is not a certified ASD-STE100 document.

## Before you contribute

Open an issue or discussion for a large interface, security, policy, or architecture change.
Use the repository issue forms for bugs, feature proposals, and documentation
problems. Do not put a suspected vulnerability in a public issue.

Keep a pull request small enough for a reviewer to understand.

Do not include secrets, production data, or code without a compatible license.

## Development

Requirements:

- Node.js 16 or later.

Read the [testing policy](docs/TESTING.md) for test scope, CI behavior, result
interpretation, and the policy for material changes.
See the [documentation index](docs/README.md) for architecture, secure
development, governance, and release requirements.

Run:

```sh
npm test
npm run validate:skill
npm run test:hosts
npm run test:installation
npm run test:release
npm run test:release-verification
```

## Pull request evidence

Describe:

- Required behavior.
- Facts and assumptions.
- Invariants.
- Security and failure effects.
- Tests that ran.
- Tests that did not run.
- Rollback or recovery.

Add or update a behavioral test for a material code change.

## Generated code

A named human contributor must review and take responsibility for generated code.

Do not submit generated code that you cannot explain, test, and license.

## Sign-off

The project uses Developer Certificate of Origin version 1.1. Read `DCO.md`.

Add a sign-off to every commit:

```sh
git commit --signoff
```

The sign-off identity must match the commit author identity. Required CI rejects
a pull-request commit without the matching sign-off.

