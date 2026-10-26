# Rivet architecture

## Purpose

Rivet is a portable backend-engineering skill with deterministic evidence
tools. It helps a coding agent reason about a change, select risk-specific
verification, and report what the available evidence proves.

## Source structure

```text
skills/rivet/
├── SKILL.md
├── agents/
├── references/
└── scripts/
    ├── rivet-evidence.mjs
    ├── rivet-ste.mjs
    └── lib/
```

`skills/rivet` is the canonical product source. Host distributions are
generated copies. Host wrappers must not fork database, testing, security,
systems, or writing guidance.

## Main components

The skill entry point routes an agent to risk-specific guidance. References
contain detailed database, security, systems, testing, and writing rules.

`rivet-evidence.mjs` is the command entry point. It discovers repository
adapters, invokes declared commands without shell evaluation, normalizes saved
tool artifacts, and emits structured evidence.

Library modules implement focused contracts for topology, tests, security,
databases, migrations, resilience, observability, performance, releases,
incidents, evaluation, and advanced verification.

Repository scripts package hosts, validate skills, run conformance probes, and
prepare blinded evaluations.

## Evidence flow

```text
repository and saved artifacts
        │
        ▼
discovery and declared adapters
        │
        ▼
bounded tool execution or artifact normalization
        │
        ▼
observed and derived evidence receipt
        │
        ▼
agent or human decision with explicit limitations
```

Rivet keeps observed, derived, inferred, and unknown evidence distinct. A
failed or unavailable tool cannot produce a pass.

## Trust boundaries

Important boundaries are:

- Repository content to agent instructions.
- Agent to the local command runner.
- Runner to repository-declared tools.
- Local process to a network or external identity.
- Generated host package to the canonical source.
- Automated evidence to accountable human review.

`THREAT-MODEL.md` describes threats and controls at these boundaries.

## Permission model

Local read-only inspection is the default. Network access, active targets,
external identities, repository writes, tickets, releases, and production
effects require explicit authorization appropriate to the action.

A host permission is not assumed to be an operating-system sandbox. Native
host conformance records tested behavior and limitations.

## Extension rules

Add a command or adapter only when it has:

- A clear backend-engineering purpose.
- A bounded permission and target model.
- Machine-readable evidence or a deterministic result.
- Explicit failure and unavailable states.
- Redaction before persistence.
- Behavioral tests.
- Documentation and host-package conformance.

Prefer established repository tools. Do not implement a weak replacement for
a mature scanner, test runner, model checker, signer, or load tool.
