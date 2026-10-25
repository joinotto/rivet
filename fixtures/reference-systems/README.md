# Reference Systems

These systems contain intentional defects.

Do not deploy or copy their implementations.

Run the seed-presence checks:

```sh
npm run test:fixtures
```

The checks confirm that each named defect is present. They are evaluation baselines, not successful product tests.

Each fixture contains:

- A small executable system or migration.
- A `seed.json` record.
- The expected defect class.
- The evidence that a future Rivet workflow must produce.

