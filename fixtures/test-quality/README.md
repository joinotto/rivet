# Test-quality fixture

This fixture demonstrates why coverage alone is not a test-quality claim.

The weak suite executes every source line but tests only age 21. The evidence
runner changes `age >= 18` to `age > 18` in a temporary copy. The weak suite
still passes, so the boundary mutant survives.

The strong suite tests ages 17 and 18. It fails against the same mutant and
kills it.

Run with Node.js 20 or later:

```sh
node fixtures/test-quality/run-evidence.mjs \
  fixtures/test-quality/evidence
```

The committed artifacts preserve:

- 100 percent observed line coverage for the weak suite.
- A surviving boundary mutant for the weak suite.
- A killed boundary mutant for the strong suite.

This fixture covers one simple boundary condition. It does not prove that a
mutation score is a complete test-quality metric.
