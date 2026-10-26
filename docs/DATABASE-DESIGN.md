# Database Design Guide

> This document uses an ASD-STE100-aligned technical writing style. It is not a certified ASD-STE100 document.

## 1. Purpose

This guide helps an agent design and change data systems.

It covers:

- Data modeling.
- Normalization.
- Constraints.
- Transactions.
- Indexes.
- Query optimization.
- Concurrency.
- Migrations.
- Security.
- Testing.
- Operations.

The guide does not assume that one database type is correct for all systems.

## 2. Start with access and integrity

Before table design, record:

- Entities and facts.
- Identity rules.
- Relationships.
- Required history.
- Read patterns.
- Write patterns.
- Data volume.
- Growth rate.
- Retention.
- Consistency need.
- Availability need.
- Privacy class.
- Recovery requirement.

Do not select a database from trend or familiarity only.

## 3. Select the data model

Use a relational database when:

- Integrity between related facts is important.
- Transactions cover several related changes.
- Query patterns can change.
- Declarative constraints can enforce important rules.

Consider another model when the workload has a clear need:

- Key-value for direct key access.
- Document for aggregate-oriented data with controlled duplication.
- Wide-column for large partitioned write workloads.
- Graph for relationship traversal.
- Time-series for time-ordered measurements and retention.
- Search index for text relevance and retrieval.

Do not use a cache, search index, or analytics store as the source of truth without an explicit consistency and recovery design.

## 4. Relational modeling

### 4.1 Model facts

One table must describe one type of fact or one stable aggregate boundary.

Use stable keys. Do not use a mutable business label as the only identity when the label can change.

### 4.2 Normalize by default

Normalization reduces unwanted redundancy and update anomalies. E. F. Codd introduced the relational model and normalization to separate the user model from physical storage and to improve consistency. [Codd paper](https://doi.org/10.1145/362384.362685)

Use this working sequence:

1. First normal form: Store atomic values for the data operations. Do not store repeating column groups.
2. Second normal form: In a composite-key table, each non-key fact must depend on the complete key.
3. Third normal form: A non-key fact must not depend on another non-key fact.
4. Boyce-Codd normal form: Each determinant must be a candidate key when the stronger rule applies.

Do not normalize mechanically beyond the point that the model remains understandable and useful.

### 4.3 Denormalize with evidence

Denormalization is a performance or distribution decision. It is not a default modeling method.

For each duplicate fact, record:

- Authoritative source.
- Copy locations.
- Update method.
- Delay tolerance.
- Conflict rule.
- Rebuild method.
- Monitoring.
- Measured benefit.

Reject the denormalization if the team cannot explain how to repair stale copies.

## 5. Put integrity in the database

Use applicable database controls:

- `NOT NULL`.
- Primary key.
- Unique constraint.
- Foreign key.
- Check constraint.
- Exclusion constraint.
- Data type and range.

A foreign key preserves referential integrity between related rows. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

Application validation improves error messages. It does not replace a database constraint for a critical invariant.

Select delete behavior deliberately:

- Restrict when dependent data must remain valid.
- Cascade when the dependent row has no meaning without the parent.
- Set null only when absence is a valid state.
- Soft delete only when product, legal, or recovery needs justify it.

## 6. Transaction design

For each transaction, record:

- Read set.
- Write set.
- Lock or conflict behavior.
- External side effects.
- Isolation need.
- Retry behavior.
- Maximum duration.

Keep transactions short. Do not hold a transaction open during an uncontrolled network call.

Do not assume that a prior application read prevents a concurrent write. Multi-version concurrency control can permit anomalies that need a higher isolation level, a lock, an atomic statement, or a constraint. PostgreSQL documents read/write conflict cycles and application-level consistency limits. [PostgreSQL consistency checks](https://www.postgresql.org/docs/current/applevel-consistency.html)

Use an outbox, inbox, saga, or equivalent pattern when database state and external side effects cannot use one atomic transaction.

## 7. Index design

### 7.1 Start from a query

Do not add an index because a column “looks searchable.”

For each proposed index, record:

- Query.
- Filter.
- Join.
- Sort.
- Group.
- Selected columns.
- Expected row count.
- Cardinality and distribution.
- Write frequency.
- Current plan and latency.
- Expected plan and latency.

Indexes improve row retrieval, but they also add storage and write cost. Use them with evidence. [PostgreSQL index introduction](https://www.postgresql.org/docs/current/indexes-intro.html)

### 7.2 Column order

For a multicolumn B-tree index:

- Put columns according to real equality, range, and order needs.
- Consider leading-column selectivity and scan boundaries.
- Do not use a fixed “most selective first” rule without the query.

PostgreSQL explains how equality constraints on leading columns and the first inequality affect the scanned index portion. [PostgreSQL multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html)

### 7.3 Index types

Select the index type for the operator and data:

- B-tree for common equality, range, and order.
- Hash for supported equality-only cases.
- GIN for applicable composite values such as arrays or text-search structures.
- GiST or SP-GiST for applicable geometric, range, nearest-neighbor, or partitioned-space operators.
- BRIN for large physically correlated data.

Verify database-specific behavior. Do not transfer an index rule from one engine to another.

### 7.4 Partial, expression, and covering indexes

Use a partial index when a stable predicate identifies the useful subset.

Use an expression index when the query uses the same stable expression.

Use included columns for an index-only plan only when the read benefit exceeds index size and write cost. PostgreSQL notes that index-only scans also depend on visibility information and workload behavior. [PostgreSQL index-only scans](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)

### 7.5 Duplicate and unused indexes

Review:

- Identical indexes.
- Prefix-overlapping indexes.
- Indexes unused during a representative period.
- Indexes that support a constraint.
- Large indexes with high write cost.
- Indexes with low-value included columns.

Do not remove an index from one statistics snapshot. Consider rare operational and reporting queries.

## 8. Query optimization

Use this sequence:

1. Define the required result.
2. Capture the query and bind-value distribution.
3. Measure a baseline.
4. Inspect the execution plan.
5. Compare estimated and actual rows.
6. Identify the dominant work.
7. Change one material factor.
8. Measure again.
9. Test with representative data.

Use `EXPLAIN` for plan inspection. Use `EXPLAIN ANALYZE` only when execution is safe. A data-changing statement will execute when it is analyzed unless it is contained and rolled back. [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)

Check:

- Full scans.
- Join algorithm.
- Join order.
- Sort and spill.
- Temporary data.
- Repeated subquery work.
- N+1 access.
- Cardinality estimate errors.
- Stale statistics.
- Parameter-sensitive plans.
- Lock waits.
- Network round trips.
- Result size.

Do not rewrite a readable query only because the new text looks faster. The observed plan and workload decide.

## 9. Pagination

Use offset pagination only when its cost and consistency are acceptable.

Use keyset pagination for large ordered sets when stable continuation is important.

The ordering must be deterministic. Include a unique tie-breaker.

Do not expose internal keys when the security or product model prohibits it.

## 10. Data types

Use a type that represents the domain.

Examples:

- Use decimal or integer minor units for money according to the monetary model.
- Store an instant with an unambiguous time-zone policy.
- Preserve the original time zone when the product needs it.
- Use bounded text only when the bound is a real business rule.
- Use an enumerated constraint only when deployment and evolution costs are acceptable.
- Use a JSON column for variable data with a defined schema and access plan, not to avoid modeling.

## 11. Security and privacy

Define:

- Data owner.
- Classification.
- Allowed actors.
- Row and column access.
- Encryption need.
- Key ownership.
- Retention.
- Deletion.
- Audit.
- Export.
- Backup treatment.

Use separate database identities for applications, migrations, analytics, and operators.

Grant the minimum permissions.

Use parameter binding. Do not construct SQL from untrusted input.

Test tenant isolation at the database and application boundary.

Do not copy production personal data into development fixtures without an approved transformation.

## 12. Migration design

Use expand, migrate, validate, and contract.

### Expand

- Add compatible schema.
- Add nullable or default-safe columns.
- Create indexes with the database-appropriate online method.
- Deploy code that can use old and new forms.

### Migrate

- Backfill in bounded batches.
- Save progress.
- Limit load.
- Make the operation safe to resume.

### Validate

- Reconcile counts and checksums.
- Verify constraints.
- Compare old and new reads.
- Inspect latency, locks, replication lag, and error rate.

### Contract

- Stop old writes.
- Remove compatibility code.
- Enforce final constraints.
- Remove old data only after the recovery window.

Never combine an irreversible destructive change with the first deployment that stops using the old data.

## 13. Database tests

Required test classes can include:

- Schema migration from the previous supported version.
- Clean schema creation.
- Constraint violation.
- Transaction rollback.
- Concurrent update.
- Deadlock or serialization retry.
- Duplicate event or request.
- Large and skewed data.
- Null and boundary values.
- Query-plan regression.
- Backup restore.
- Point-in-time recovery.
- Replica delay.
- Failover.
- Migration interruption and resume.

For distributed databases, test the stated consistency model. Jepsen uses concurrent operation histories and controlled failure to test consistency claims. A product label is not sufficient proof of behavior. [Jepsen analyses](https://jepsen.io/analyses)

## 14. Operational design

Record:

- Capacity limit.
- Connection limit and pool policy.
- Slow-query threshold.
- Lock and deadlock metrics.
- Replication lag.
- Backup schedule.
- Restore objective.
- Recovery point objective.
- Recovery time objective.
- Maintenance.
- Data growth.
- Archive and deletion.

Test restore. A successful backup job does not prove recoverability.

## 15. Agent database review

Before the agent changes a schema or query, it must show:

```text
Data facts
Access patterns
Integrity rules
Concurrency risks
Security classification
Current evidence
Proposed model or query
Proposed constraints
Proposed indexes
Migration
Tests
Operational effect
Unknowns
```

The report must identify database-specific assumptions.

## 16. Common prohibited shortcuts

The agent must not:

- Add an index without a target query.
- Remove normalization without a synchronization design.
- use an application check instead of an available critical constraint.
- use `SELECT *` in a stable service contract without a reason.
- add unbounded queries or exports.
- use offset pagination by default for a large changing set.
- hold a transaction across an uncontrolled external call.
- add a retry to a non-idempotent write.
- combine a destructive migration with immediate code dependency.
- use production data as an ordinary test fixture.
- claim a query is faster without a baseline and representative measurement.
- claim a migration is safe without interruption and recovery evidence.

