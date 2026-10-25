# Command and Workflow Catalog

## 1. Command design

Use one top-level skill.

Example:

```text
/backend <command> <target>
```

Each command must:

1. Load relevant context.
2. State the risk mode.
3. State the planned tools and permissions.
4. Execute the minimum required work.
5. Verify the result.
6. Produce an evidence receipt.
7. State limitations.

## 2. Version 1 commands

### `init`

Purpose: Record product, system, test, security, and operation context.

Must not:

- Invent architecture.
- Rewrite existing standard files.
- collect secrets.

### `map`

Purpose: Create a system map from code and configuration.

Output:

- Modules.
- Services.
- Entry points.
- Data stores.
- queues and jobs.
- External dependencies.
- Trust boundaries.
- Owners.
- Unknown areas.

### `shape`

Purpose: Define the behavior and constraints of a change before implementation.

Output:

- Change record.
- Invariants.
- Failure cases.
- Verification plan.

### `impact`

Purpose: Estimate change impact from call sites, contracts, schemas, data flow, and deployment topology.

Must distinguish direct evidence from inferred impact.

### `database`

Purpose: Design or review a data model, schema, query, index, transaction, or data-access boundary.

Required inputs:

- Data facts.
- Access patterns.
- Integrity rules.
- Volume and growth.
- Consistency need.
- Privacy class.

Required output:

- Normalization decision.
- Constraints.
- Transaction boundaries.
- Indexes tied to named queries.
- Migration plan.
- Query and concurrency tests.
- Operational effect.
- Unknowns.

The command must not add an index without plan or workload evidence.

### `verify`

Purpose: Select and run evidence for the current change.

Checks can include:

- Build.
- Type checks.
- Focused tests.
- Integration tests.
- Contract tests.
- Static analysis.
- Dependency changes.
- Migration checks.

### `test`

Purpose: Design or improve tests for identified risks.

Test families:

- Example-based unit tests.
- Integration tests.
- Contract tests.
- End-to-end tests.
- Property-based tests.
- Metamorphic tests.
- Fuzz tests.
- Mutation tests.
- Concurrency tests.
- Failure-injection tests.
- Load tests.
- Recovery tests.

The command must not generate tests only from the current implementation.

### `review`

Purpose: Review design, correctness, maintainability, and evidence.

Use an independent review context when the agent system supports it. Do not let the implementation explanation anchor the first review.

### `threat-model`

Purpose: Identify assets, actors, entry points, trust boundaries, abuse cases, threats, controls, and residual risk.

Output must include verification for each important mitigation.

### `security`

Purpose: Run the applicable secure-development checks.

Possible checks:

- Authentication and session controls.
- Authorization.
- Input and output handling.
- Cryptography.
- Secrets.
- Data protection.
- Logging.
- Error handling.
- API controls.
- SSRF and injection.
- File and deserialization behavior.
- Build and deployment controls.

Map findings to OWASP ASVS, CWE, or another applicable standard.

### `dependencies`

Purpose: Review dependency, license, maintenance, provenance, and vulnerability risk.

Priority model:

```text
priority =
  known_exploitation
  + exploitation_probability
  + runtime_reachability
  + exposure
  + asset_criticality
  + fix_availability
  - mitigation_strength
  - fix_risk
```

Do not use this expression as a universal numeric formula. Use it as a required factor list.

### `sbom`

Purpose: Create or verify an SPDX or CycloneDX software bill of materials.

The command must record the build or source revision that the SBOM describes.

### `contract`

Purpose: Review or verify API, event, and job contracts.

Checks:

- Compatibility.
- Error format.
- Pagination.
- Idempotency.
- Authentication and authorization.
- Rate limits.
- Timeouts.
- Version policy.
- Consumer tests.

### `migrate`

Purpose: Plan and verify data or interface migration.

Required sequence:

1. Expand.
2. Migrate.
3. Validate.
4. Contract.

Required evidence:

- Backup or recovery method.
- Dry run.
- Compatibility window.
- Progress metrics.
- Abort rule.
- Rollback or forward-fix plan.

### `resilience`

Purpose: Review timeouts, retries, backoff, jitter, idempotency, circuit breaking, bulkheads, load shedding, and recovery.

The command must trace the end-to-end deadline.

### `observe`

Purpose: Review logs, metrics, traces, correlation, sampling, personal data, cardinality, dashboards, and alerts.

An alert must identify:

- User or system harm.
- Urgency.
- Owner.
- First diagnostic action.

### `performance`

Purpose: Measure and improve latency, throughput, capacity, memory, CPU, database work, and cost.

The command must require a workload and a baseline. It must not optimize from code appearance.

### `release`

Purpose: Prepare a staged release decision.

Output:

- Evidence summary.
- Open risks.
- Compatibility status.
- Rollout stages.
- Abort conditions.
- Rollback procedure.
- Monitoring window.

### `incident`

Purpose: Support diagnosis during an incident.

The command must default to read-only actions. It must keep a time-ordered action log. It must not make a production change without explicit approval.

### `postmortem`

Purpose: Produce a blameless record of impact, detection, response, contributing conditions, recovery, and preventive work.

Do not identify “human error” as the root cause without system analysis.

### `doctor`

Purpose: Detect stale context, broken adapters, missing tools, invalid policy, expired waivers, and unverifiable evidence.

### `stateful`

Purpose: Initialize and validate a stateful property-test model before a
language-native runner generates command sequences.

The model must define states, commands, preconditions, transitions,
postconditions, invariants, reset behavior, isolation, and reproducibility
settings. Rivet validates the model. It does not claim that validation executed
the system.

### `fuzz`

Purpose: Normalize saved evidence from a coverage-guided fuzzing campaign.

The report must bind the engine, target, source revision, command, runtime,
execution count, sanitizer, and crash artifacts. A campaign that observed no
crash is not proof of safety.

### `chaos`

Purpose: Initialize and validate a bounded chaos experiment, then normalize its
saved result.

Rivet requires an exact environment, target count, steady-state hypothesis,
probes, blast radius, stop conditions, rollback verification, user-harm
signal, and approval owner. It does not inject faults.

### `hooks`

Purpose: Configure low-cost automatic checks for changed backend files.

The hook must not run heavy integration, active security, load, or fuzz tests after each edit.

## 3. Later commands

Add only after Version 1 has evidence that users need them:

- `mutation`
- `load`
- `formalize`
- `privacy`
- `compliance-map`
- `capacity`
- `cost`
- `deprecate`
- `recover`

## 4. Commands to exclude

Do not add:

- `hack`
- `exploit-any`
- `pentest <public-url>`
- `auto-fix-all`
- `make-secure`
- `make-scalable`
- `compliance-certify`
- `zero-downtime`

These names create unsafe authority or false guarantees.

## 5. Recommended normal workflow

For a backend change:

```text
init → shape → impact → implement → verify → review → release
```

For a data change:

```text
shape → database → impact → migrate or implement
→ test → verify → staged release
```

For a high-risk change:

```text
shape → threat-model → impact → specification/invariants
→ implement in small steps → test → security → resilience
→ verify → independent review → staged release
```

For a vulnerability:

```text
dependencies/security → confirm applicability → prioritize
→ reproduce safely → fix → regression test → rescan
→ release → monitor
```

