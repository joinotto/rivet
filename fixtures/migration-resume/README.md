# Migration interruption and resume fixture

This fixture applies five ordered rows in bounded batches. It stops after the
first batch, keeps the durable cursor, and resumes from the next row.

Run:

```sh
npm run test:migration
```

The test fails if a row is applied twice, a value differs, or the final counts
do not reconcile. This small in-memory model does not prove production
database behavior.
