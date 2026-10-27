# Test Design

Use tests to challenge the change, not to repeat its implementation.

## Select by risk

| Risk | Useful evidence |
|---|---|
| Calculation | Examples, boundaries, properties |
| Database rule | Constraint plus integration test |
| API compatibility | Schema plus consumer contract |
| Authorization | Role-object matrix and negative cases |
| Queue or job | Duplicate, order, delay, restart, recovery |
| Parser | Property and coverage-guided fuzz tests |
| Migration | Dry run, reconciliation, interruption, recovery |
| Performance | Representative workload and baseline |
| Distributed invariant | Model, operation history, or fault injection |

Do not enforce a fixed test pyramid. Prefer fast focused checks, then add broader evidence where fidelity is necessary.

## Design

For each important behavior, consider:

- Normal.
- Boundary.
- Invalid.
- Unauthorized.
- Duplicate.
- Concurrent.
- Delayed.
- Interrupted.
- Recovery.

First predict which test must fail before the change.

For important suites, use mutation or fault seeding to confirm that tests can detect a relevant defect. Coverage alone is not proof.

## Quality

Reject tests that:

- Assert private steps instead of observable behavior.
- Cannot fail for the named defect.
- Share hidden mutable state.
- Depend on uncontrolled time or network behavior.
- Hide nondeterminism with large retries.
- Use unrealistic data for a data-dependent risk.

Record skipped, flaky, unavailable, and quarantined tests separately from passed tests.

## Execution environment

Record the runtime, command, configuration, and permission boundary. If a
runner cannot start, distinguish that failure from a failed assertion. Use
a documented local runner option when it can preserve the same tests and
boundary. Do not weaken isolation to make a check pass.

A successful application build does not prove that test files compile or that
test assertions pass. Observe those checks separately. Disable unrelated
telemetry and other external side effects in isolated tests. Close servers and
connections after each test.

