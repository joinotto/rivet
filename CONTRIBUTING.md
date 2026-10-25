# Contributing

> This document uses an ASD-STE100-aligned technical writing style. It is not a certified ASD-STE100 document.

## Before you contribute

Open an issue or discussion for a large interface, security, policy, or architecture change.

Keep a pull request small enough for a reviewer to understand.

Do not include secrets, production data, or code without a compatible license.

## Development

Requirements:

- Node.js 16 or later.
- Python 3 for the optional skill validator.
- PyYAML for the bundled skill validator.

Run:

```sh
npm test
```

When PyYAML is available, run:

```sh
npm run validate:skill
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

The project intends to use the Developer Certificate of Origin. Add a `Signed-off-by` line to each commit after the project publishes its final contribution policy.

