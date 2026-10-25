# Reference Systems

These systems contain intentional defects.

Do not deploy or copy their implementations.

Run the seed-presence checks:

```sh
npm run test:fixtures
```

The checks confirm that each named defect is present. They are evaluation baselines, not successful product tests.

Score the published expected findings:

```sh
npm run test:evaluation
```

For an agent evaluation, replace `expected-findings.json` with the agent's findings artifact. Do not give the expected file to the evaluated agent.

Each fixture contains:

- A small executable system or migration.
- A `seed.json` record.
- The expected defect class.
- The evidence that a future Rivet workflow must produce.

The distributed-failure fixture demonstrates duplicate delivery, delayed
out-of-order delivery, partial completion, and a lost response after completed
work. These are separate observations of one missing recovery design.

