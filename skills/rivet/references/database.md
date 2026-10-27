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

State the functional dependencies before claiming a normal form. A repeated
tenant identifier can be an integrity or access requirement. Explain that
choice. Do not label a denormalized design fully normalized.

## Ordering and pagination

Define what "newest" means: event time, row creation time, or committed
visibility. These orders can differ.

- Use a unique, immutable ordering tuple and matching cursor comparison.
- Preserve timestamp precision when encoding and decoding the cursor.
- Treat UUIDv7 time ordering as distinct from strict generation or commit
  ordering. Same-millisecond values, multiple generators, and clock changes
  require explicit assumptions.
- State how late commits, updates, and deletes affect traversal. Keyset
  pagination alone does not provide a consistent snapshot.
- Validate cursor size, format, version, filters, and tenant scope. Encoding
  is not authentication. Enforce authorization on every page.

See [RFC 9562, sections 5.7 and 6.2](https://www.rfc-editor.org/rfc/rfc9562.html)
and [PostgreSQL ordering requirements](https://www.postgresql.org/docs/current/queries-limit.html).

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

