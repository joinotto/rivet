# Rivet

Status: research and product proposal  
Date: 2026-10-25  
Product name: Rivet

## Current implementation

Version `0.1.0` contains:

- A repository-local `rivet` agent skill.
- The TRACE engineering reasoning protocol.
- Focused database, testing, security, and system-design references.
- A dependency-free evidence runner for Node.js 16 or later.
- Project and context-file discovery.
- Existing test, lint, type-check, and build-script discovery.
- Initial Rust, Go, and Python test discovery.
- Dry-run verification.
- Selected check execution.
- Changed-file risk classification.
- TRACE change-record generation.
- ASD-STE100-aligned Markdown checks.
- JSON evidence receipts.
- Distinct pass, fail, incomplete, and insufficient-evidence results.

Run the tests:

```sh
cd rivet
npm test
```

Inspect a project:

```sh
node skills/rivet/scripts/rivet-evidence.mjs inspect
```

Preview its detected checks:

```sh
node skills/rivet/scripts/rivet-evidence.mjs verify --dry-run
```

Classify a change:

```sh
node skills/rivet/scripts/rivet-evidence.mjs change
```

Create a TRACE change record:

```sh
node skills/rivet/scripts/rivet-evidence.mjs record \
  --title "Order authorization" \
  --output .rivet/changes/order-authorization.md
```

Check skill documentation:

```sh
npm run check:ste
```

## Decision

Build it.

Do not build a large prompt library.

Build an evidence-driven engineering system for AI coding agents. The system must help an agent to design, test, secure, operate, and change backend software. It must use proven external tools. It must save durable system context. It must show the evidence for each claim.

## Product thesis

Backend work has the same coordination problem that Impeccable solves for frontend work:

- The agent does not know the product constraints.
- The agent does not know the architecture decisions.
- The agent applies generic patterns.
- The agent changes code before it understands failure modes.
- The agent writes tests that only confirm its own implementation.
- The agent reports security from static inspection without proof.
- The agent optimizes local code and damages system behavior.
- The agent does not preserve operational knowledge.

The product can correct these problems if it combines:

1. Durable context.
2. A repeatable engineering reasoning method.
3. Focused engineering playbooks.
4. Database design and verification.
5. Executable verification.
6. Risk-based security controls.
7. Test and runtime evidence.
8. Safe agent permissions.
9. Open-source governance.

## Non-negotiable rule

The product must separate these result classes:

- **Observed:** A tool or runtime produced the evidence.
- **Derived:** The system calculated the result from observed evidence.
- **Inferred:** The agent formed a conclusion from incomplete evidence.
- **Unknown:** The system does not have sufficient evidence.

The product must not present an inferred result as an observed result.

## Documents

- [Research foundation](RESEARCH-FOUNDATION.md)
- [Engineering reasoning method](ENGINEERING-REASONING.md)
- [Database design guide](DATABASE-DESIGN.md)
- [Product specification](PRODUCT-SPECIFICATION.md)
- [Command and workflow catalog](COMMAND-CATALOG.md)
- [Security and evidence model](SECURITY-MODEL.md)
- [Roadmap](ROADMAP.md)
- [Open-source foundation](OPEN-SOURCE-FOUNDATION.md)
- [Technical writing rules](TECHNICAL-WRITING.md)
- [ASD-STE100 for agent skills](docs/ASD-STE100-FOR-SKILLS.md)

## Honest assessment

The opportunity is strong. The scope is dangerous.

The first release must have a narrow purpose:

> Help an agent make a safe backend change and prove that the change works.

Do not start with autonomous penetration testing, production incident control, compliance certification, or a universal architecture generator. These areas have high risk and weak verification.

Start with repository context, change-risk analysis, test selection, deterministic checks, dependency risk, threat modeling, and an evidence report.

## Validation status

The evidence-runner behavioral tests pass on Node.js 16.13.1.

The skill has no unfinished scaffold markers. Its frontmatter, folder name, references, script path, and UI metadata were inspected manually.

The bundled `quick_validate.py` validator could not run in the current environment because its `yaml` Python module is not installed. This condition is an unavailable validation tool. It is not a successful validation result.


