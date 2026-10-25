# Database Work

Use this reference for schema, query, index, transaction, and migration work.

## Before editing

Record:

- Facts and relationships.
- Identity and integrity rules.
- Reads, writes, volume, growth, and retention.
- Consistency and availability needs.
- Sensitive data and permitted actors.
- Recovery objectives.

## Model

- Normalize relational facts by default.
- Denormalize only with measured benefit and a synchronization, conflict, monitoring, and rebuild design.
- Use stable keys.
- Put critical invariants in database constraints when possible.
- Choose delete behavior deliberately.
- Do not use JSON to avoid modeling stable facts.

## Transactions

State the read set, write set, isolation need, possible conflicts, external side effects, retry behavior, and maximum duration.

Do not hold a transaction open across an uncontrolled network call. Do not assume that an application read prevents a concurrent write.

For database state plus an external side effect, use an applicable outbox, inbox, saga, or reconciliation design.

## Indexes and queries

Do not add an index without a target query.

Capture:

- Query and representative parameters.
- Filters, joins, order, grouping, and result size.
- Data distribution.
- Current plan, latency, and workload.
- Expected plan and write/storage cost.

Inspect estimated and actual rows. Check scans, joins, sorts, spills, repeated work, N+1 access, stale statistics, locks, and network round trips.

Use engine-specific index behavior. Do not apply a PostgreSQL index rule to another database without verification.

## Migration

Use:

1. Expand with compatible schema.
2. Migrate in bounded, resumable batches.
3. Validate with reconciliation and runtime evidence.
4. Contract only after the compatibility and recovery window.

Do not combine an irreversible destructive change with the first deployment that stops use of the old data.

## Verify

Use applicable tests:

- Constraint violation.
- Clean creation and upgrade from the previous version.
- Rollback and retry.
- Concurrent update.
- Duplicate, delayed, or out-of-order work.
- Large and skewed data.
- Query-plan regression.
- Migration interruption and resume.
- Backup restore and recovery.

Report database-specific assumptions and tests that did not run.

