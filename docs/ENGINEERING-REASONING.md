# Engineering Reasoning Method

> This document uses an ASD-STE100-aligned technical writing style. It is not a certified ASD-STE100 document.

## 1. Purpose

This method guides an agent before and during backend work.

The method does not ask the agent to publish private chain-of-thought. It requires short, reviewable engineering artifacts:

- Facts.
- Assumptions.
- Unknowns.
- Invariants.
- Alternatives.
- Decisions.
- Predictions.
- Evidence.

The user must be able to inspect and correct these artifacts.

## 2. Main rule

Do not start with code.

Start with the behavior that the system must preserve or create.

For a small and low-risk change, this analysis can be five lines. For a critical distributed change, it can include a formal model and an independent review.

## 3. The TRACE method

Use TRACE for each material change.

### T — Target the real problem

State:

- Who or what has the problem.
- The current behavior.
- The required behavior.
- The reason for the change.
- The success measure.
- Items that are outside the change.

Bad target:

> Improve database performance.

Good target:

> Reduce the p95 latency of the account-history query from 900 ms to less than 250 ms for accounts with 100,000 transactions. Do not change result order or authorization behavior.

### R — Record facts, assumptions, and unknowns

Use three separate lists.

**Facts** have repository, runtime, user, or tool evidence.

**Assumptions** are working statements that need confirmation.

**Unknowns** can change the design or the risk.

Example:

```text
Facts
- The endpoint sorts by created_at descending.
- The query always filters by account_id.

Assumptions
- Most requests read the newest 50 rows.

Unknowns
- The production distribution of rows per account.
- Whether deleted transactions remain in the table.
```

The agent must not convert an assumption into a fact after it repeats the assumption.

### A — Analyze the system

Analyze only the dimensions that can change the result.

Required dimensions:

- Data.
- State.
- Interfaces.
- Dependencies.
- Concurrency.
- Failure.
- Security.
- Operations.

For each dimension, ask:

1. What enters the system?
2. What state changes?
3. What must always be true?
4. What can fail?
5. What can repeat?
6. What can arrive late or out of order?
7. Who can perform the action?
8. How does an operator detect and recover from failure?

### C — Compare alternatives

For each material alternative, record:

- Description.
- Benefit.
- Cost.
- Failure mode.
- Reversibility.
- Evidence needed.
- Reason for rejection or selection.

Do not make a false comparison. Do not add weak alternatives only to make the preferred design look good.

When one option is sufficient, state why a comparison is not useful.

### E — Execute and evaluate

Before implementation, make predictions:

- Tests that must fail before the change.
- Metrics that must change.
- Queries that must use a different plan.
- Threats that the control must stop.
- Compatibility behavior that must remain.

Then:

1. Make the smallest coherent change.
2. Run the planned checks.
3. Try to disprove the result.
4. Compare observed results with predictions.
5. Record deviations.
6. Decide to keep, revise, or revert the change.

## 4. Invariant-first design

An invariant is a condition that must remain true.

Examples:

- One payment attempt can create no more than one charge.
- A user can read data only from an authorized tenant.
- The inventory count cannot be less than zero.
- An accepted event is processed at least one time.
- An account-history response is sorted by creation time.

For each invariant, record:

- Scope.
- Owner.
- Enforcement point.
- Violation effect.
- Test method.
- Runtime detection.
- Recovery method.

Do not use a test as the only enforcement for a data invariant when the database can enforce it with a constraint.

## 5. Failure-first design

For each dependency and side effect, evaluate:

- Timeout.
- Refusal.
- Slow response.
- Partial response.
- Duplicate response.
- Lost response.
- Stale response.
- Invalid response.
- Dependency restart.
- Caller restart.
- Network partition.
- Resource exhaustion.

Do not add a retry until the operation is safe to repeat.

Trace the total deadline through all calls. A child timeout must leave time for the caller to handle the result.

## 6. Security-first design

Before code, identify:

- Asset.
- Actor.
- Entry point.
- Trust boundary.
- Required permission.
- Abuse case.
- Sensitive data.
- Audit requirement.

Use deny by default.

Verify authorization at the operation and object boundary. Authentication does not prove authorization.

Do not log secrets, credentials, session tokens, or unnecessary personal data.

## 7. Test design while coding

Use tests to challenge the design.

For each behavior, include applicable cases:

- Normal.
- Boundary.
- Invalid.
- Unauthorized.
- Duplicate.
- Concurrent.
- Delayed.
- Interrupted.
- Recovery.

Use a risk-based test type:

| Risk | Preferred evidence |
|---|---|
| Pure calculation | Example and property tests |
| Database rule | Constraint and integration test |
| API compatibility | Schema and consumer contract test |
| Authorization | Role-object matrix and negative tests |
| Queue processing | Duplicate, delay, order, and restart tests |
| Parser | Fuzz and property tests |
| Migration | Dry run, reconciliation, interruption, and recovery |
| Performance | Representative workload and baseline |
| Distributed invariant | Model, history, or fault-injection test |

Do not generate tests that duplicate the implementation steps. Test observable behavior and invariants.

## 8. Evidence ladder

Use the strongest available evidence.

From weak to strong:

1. Agent opinion.
2. Static inspection.
3. Type or compile check.
4. Deterministic static analysis.
5. Focused test.
6. Integration or contract test.
7. Runtime measurement.
8. Fault or adversarial test.
9. Production-like staged observation.
10. Independent human or formal review.

Higher evidence does not always replace lower evidence. A runtime test does not replace a code review of cryptographic key handling.

## 9. Stop conditions

The agent must stop and ask for direction when:

- Two plausible designs have different product effects.
- A destructive action has no verified recovery method.
- A critical security assumption is unknown.
- The target environment is not authorized.
- The change needs production credentials.
- A migration cannot preserve compatibility.
- A tool failure prevents a required claim.
- The requested behavior conflicts with a recorded invariant.

## 10. Review report

Use this format:

```text
Target
Required behavior

Facts
Assumptions
Unknowns

Invariants
Threats and failure cases

Alternatives
Decision

Implementation
Evidence
Contradictory evidence

Open risks
Rollback
Recommendation
```

Keep each section concise. Link to detailed evidence.

## 11. Product implementation

The product must implement TRACE as a common protocol. Commands such as `shape`, `database`, `test`, `security`, and `verify` must use the same terms and evidence classes.

The agent must show the user a short decision record. It must not show token-by-token hidden reasoning.

