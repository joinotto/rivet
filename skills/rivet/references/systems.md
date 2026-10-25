# System Design and Reliability

## Boundaries

Hide changeable decisions behind small stable interfaces. Do not split a system into services only because the repository is large.

For each boundary, identify:

- Responsibility.
- Owned state.
- Contract.
- Failure behavior.
- Compatibility policy.
- Owner.

## Invariants

Write important invariants before implementation. For complex concurrent state, use a state machine or formal model when it reduces risk.

## Distributed failure

For each remote operation, consider:

- Timeout.
- Refusal.
- Slow or partial response.
- Lost response after completed work.
- Duplicate, delayed, or out-of-order request.
- Caller and dependency restart.
- Resource exhaustion.

Trace the end-to-end deadline. A child timeout must leave time for the caller to respond.

Do not retry an operation until it is safe to repeat. Bound retries. Use backoff and jitter. Prevent retry multiplication through call chains.

## Interfaces

For APIs and events, verify:

- Compatibility.
- Idempotency.
- Authentication and authorization.
- Error behavior.
- Pagination and ordering.
- Rate and size limits.
- Timeout and cancellation.
- Version and deprecation policy.

Use expand-and-contract changes for incompatible data or interface evolution.

## Reliability

Define service-level indicators from user outcomes. Do not select a reliability target from convention.

Connect:

- Objective.
- Error budget.
- Release policy.
- Alert.
- Operator action.
- Recovery procedure.

Instrumentation must preserve operation context across logs, metrics, and traces. Review personal data, cardinality, sampling, and cost.

