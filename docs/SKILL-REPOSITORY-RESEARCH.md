# Agent Skill Repository Research

Research date: 2026-10-25

## Purpose

This review identifies useful skill-engineering patterns.

It does not use repository popularity as proof of backend correctness.

## Selection method

Prefer a repository when it has:

- A known individual or organization.
- A clear license.
- Source history.
- Tests or evaluations.
- Maintained code.
- Concrete scripts and references.
- Security boundaries.

Treat star count as an adoption signal only. Do not treat it as quality evidence. Exclude anonymous catalogs and repositories that make claims without verifiable artifacts.

## Repositories reviewed

### Anthropic Skills

Repository: <https://github.com/anthropics/skills>

Useful patterns:

- Small skill entry points.
- Scripts used as black boxes.
- `--help` before source inspection.
- Decision trees for tool selection.
- References loaded only when applicable.
- Explicit local-target boundaries in testing workflows.

Rivet use:

- Keep the main skill short.
- Run deterministic helpers without loading their full source.
- Put domain procedures in references.

### OpenAI Skills

Repository: <https://github.com/openai/skills>

Useful patterns:

- Required frontmatter.
- A stable skill folder structure.
- Separate UI metadata.
- Progressive disclosure.
- Deterministic validation.
- Explicit invocation and permission boundaries.

Rivet use:

- Maintain `SKILL.md`, `agents/`, `references/`, and `scripts/`.
- Validate structure before release.
- Keep automatic discovery separate from action authorization.

### Superpowers by Jesse Vincent

Repository: <https://github.com/obra/superpowers>

Useful patterns:

- Verification before a completion claim.
- Root-cause investigation before a fix.
- A failing test before a behavioral fix when practical.
- Bounded workflows with stop conditions.
- Tests for skills and hooks.

Risks:

- Absolute rules can over-trigger.
- A mandatory process can add cost to a small task.

Rivet use:

- Apply risk modes.
- Require fresh evidence before a claim.
- Do not force the full process on mechanical changes.

### Agent Skills by Addy Osmani

Repository: <https://github.com/addyosmani/agent-skills>

The original summary was expanded into a pinned source and test audit:
[Addy Osmani agent-skills audit](ADDY-AGENT-SKILLS-AUDIT.md).

The strongest additions are deterministic routing tests, a skill-change
rejection ledger, quality ratchets, pressure cases, and host-surface drift
checks. Rivet rejects mandatory universal workflows and fixed gates that have
no project evidence.

## Rejected evidence

Do not use these as engineering authority:

- “Awesome” lists without validation.
- Generated skill dumps.
- Repository descriptions without working artifacts.
- Star counts that have no credible usage history.
- Skills that hide their sources.
- Security instructions without a versioned standard or executable test.
- Claims that an agent can guarantee security or correctness.

## Adopted design rules

1. Use progressive disclosure.
2. Use deterministic scripts for repeated mechanics.
3. Keep scripts safe to run without source ingestion.
4. Require evidence before completion claims.
5. Use bounded stop conditions.
6. Add explicit non-use cases.
7. Persist project constraints.
8. Test skill behavior, not only Markdown structure.
9. Keep technical doctrine tied to primary sources.
10. Use popular skills for interaction design, not as standards authority.

