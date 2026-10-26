# Testing Policy

> This document uses an ASD-STE100-aligned technical writing style. It is not a
> certified ASD-STE100 document.

## Local tests

Run the behavioral suite:

```sh
npm test
```

Run the full deterministic project gates:

```sh
npm run test:hosts
npm run test:evaluation
npm run test:fuzz
npm run validate:skill
npm run validate:rejections
npm run validate:openssf
npm run test:routing
npm run check:ste
```

Run the isolated coverage-guided campaign with Node.js 22:

```sh
npm ci --prefix fuzz/coverage-guided
node scripts/run-coverage-guided-fuzz.mjs \
  --executions 10000 \
  --workspace .rivet/coverage-guided \
  --output .rivet/coverage-guided/report.json
```

A command exit status of zero means that its published assertions passed. It
does not prove production correctness or native host behavior. Read each
command's limitations in its output and conformance document.

## Continuous integration

Pull requests run:

- The deterministic gates on Node.js 16 and Node.js 22.
- Repository-wide CodeQL.
- OSV dependency-difference scanning.
- A bounded deterministic parser-fuzz campaign.
- A path-scoped Jazzer.js/libFuzzer campaign on Node.js 22.
- DCO sign-off verification.

The protected branch requires the configured checks to pass on the current
pull-request revision. GitHub Actions logs are the authoritative CI result.

## Change policy

A material behavior change must add or update an automated behavioral test.
Material changes include:

- A public command, option, schema, or adapter behavior.
- Security, authorization, validation, or redaction behavior.
- Database, migration, retry, concurrency, or failure behavior.
- Evidence classification or release decisions.
- Host packaging or routing behavior.

A documentation-only change does not require a new behavioral test when it
does not change a machine contract. It must still pass the relevant document,
schema, link, and example checks.

Record tests that did not run and explain why. Do not describe a skipped or
unavailable test as passed.
