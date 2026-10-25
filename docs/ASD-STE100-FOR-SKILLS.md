# ASD-STE100 for Agent Skills

> This document uses an ASD-STE100-aligned technical writing style. It is not a certified ASD-STE100 document.

## 1. Purpose

This document defines how Rivet uses Simplified Technical English in agent skills.

ASD-STE100 is a controlled natural language for technical documentation. Issue 9 was published on 2025-01-15. ASD owns the standard and its trademark.

Official sources:

- <https://asd-ste100.org/>
- <https://www.asd-europe.org/standards-specifications/simplified-technical-english/>
- <https://asd-ste100.org/STEMGTraining.pdf>

## 2. Important limit

Rivet must not claim ASD-STE100 compliance from a prompt or a linter.

The standard has:

- Writing rules.
- A controlled general dictionary.
- Rules for project technical names and technical verbs.

The official specification is the authority. Training and subject knowledge are also important.

Rivet does not redistribute the controlled dictionary.

## 3. Why STE is useful for skills

An agent skill has many properties of a maintenance procedure:

- It gives instructions.
- It names conditions.
- It states warnings.
- It defines stop conditions.
- It identifies evidence.
- A user can act on the text without a follow-up question.

Ambiguous instructions can cause an agent to:

- Run the wrong command.
- Change the wrong target.
- Use more authority than the user gave.
- Treat an assumption as a fact.
- Report a tool failure as a pass.

STE principles reduce these risks.

## 4. Where Rivet can use STE

Use the Rivet STE profile when ambiguous text can cause an incorrect or unsafe action:

- High-risk skill instructions.
- High-risk command references.
- Destructive or privileged procedures.
- Warnings.
- Findings.
- Runbooks.
- Evidence summaries.
- Migration steps.
- Recovery steps.
- Configuration instructions.

Do not force the profile on:

- Ordinary conversation.
- Brainstorming.
- Low-risk tasks.
- Informal code-review comments.
- Research analysis.
- Legal text.
- Direct quotations.
- Source names.
- Code.
- API identifiers.
- Terms that a standard requires.

For these items, preserve usefulness, precision, and natural language before controlled style.

The agent can use selected STE principles without applying the full Rivet profile. For example, it can put one dangerous action in one sentence without checking every descriptive sentence.

## 5. Three validation levels

### Level 1: Deterministic fault

A tool can identify the condition with high confidence.

Examples:

- A sentence exceeds the configured word limit.
- A semicolon joins instructions.
- A prohibited vague phrase occurs.
- A required warning label is absent from a dangerous procedure.

### Level 2: Heuristic warning

A tool can identify a possible condition.

Examples:

- Passive voice.
- A long noun cluster.
- More than one instruction in a sentence.
- An undefined abbreviation.
- Inconsistent terminology.

A human or agent must review the warning.

### Level 3: Semantic review

A checker cannot reliably decide the condition.

Examples:

- The paragraph has one topic.
- The selected word has the correct approved meaning.
- A technical name is necessary.
- The instruction identifies the correct actor.
- The warning describes the real risk.
- The document omits required operational knowledge.

Rivet must not convert a Level 3 review into an automatic pass.

## 6. Optional Rivet STE profile

Use these defaults when the profile applies:

- Use one term for one meaning.
- Use one meaning for one term.
- Identify the actor when the actor is important.
- Use the imperative form for an instruction.
- Use the active voice when possible.
- Put a condition before the related action.
- Put one principal instruction in one sentence.
- Use a list for three or more related items.
- Keep procedural sentences at 20 words or fewer when practical.
- Keep descriptive sentences at 25 words or fewer when practical.
- Define an abbreviation at its first use.
- Do not use an idiom.
- Do not use a semicolon to join instructions.
- Do not use vague marketing words in a requirement.
- Put a warning before the dangerous action.
- Use `must` for a requirement.
- Use `must not` for a prohibition.
- Use `can` for capability.
- Use `may` for permission.

The word limits are checker defaults. They do not replace the official rules.

## 7. Project terminology

Each repository can have an approved terminology file:

```text
.rivet/terminology.yml
```

Example:

```yaml
technical_names:
  - idempotency key
  - event store
  - tenant
technical_verbs:
  - backfill
  - deserialize
abbreviations:
  API: application programming interface
  SLO: service-level objective
preferred_terms:
  start:
    - initiate
    - commence
  use:
    - utilize
    - leverage
```

This file is a project vocabulary. It is not the ASD-STE100 controlled dictionary.

## 8. Skill instruction pattern

Use this order:

1. State the purpose.
2. State the condition.
3. State the instruction.
4. State the required evidence.
5. State the stop condition.
6. State the limitation.

Example:

> If the migration removes data, make a verified backup first. Stop if you cannot restore the backup in the test environment.

## 9. Finding pattern

Use:

```text
Condition
Evidence
Effect
Action
Verification
Limitation
```

Example:

> The worker retries the payment request three times. The request has no idempotency key. A retry can create a duplicate charge. Add one stable key for each payment attempt. Test a lost response after the provider completes the charge. This test does not verify the production provider.

## 10. Warning pattern

Use a warning before an action that can cause injury, data loss, security exposure, service outage, or an irreversible change.

Example:

> **WARNING:** This command removes customer records. Verify the backup before you run the command.

Do not hide a warning in a note after the action.

## 11. Prompt and context design

Keep the skill entry point short. Do not add STE rules that do not change an agent decision or reduce a real ambiguity.

Put domain procedures in references. Load only the applicable reference. This method reduces instruction conflict and keeps one term in one context.

Do not repeat the same rule in many references. Put a shared rule in `SKILL.md` or one common reference.

Use machine-readable schemas for evidence. Do not make an agent infer field meanings from prose.

## 12. Checker behavior

The Rivet checker must:

- Ignore code fences.
- Avoid changes to source code.
- Give a line number.
- State the rule that caused the result.
- Mark a result as a fault or a warning.
- Use nonzero exit status only for configured faults.
- State that the result is not certification.

The checker must not:

- Reproduce the ASD controlled dictionary.
- Mark all passive phrases as definite errors.
- change technical identifiers.
- Rewrite legal or license text automatically.
- Claim full ASD-STE100 compliance.

## 13. Human review

Before a public release, use a trained technical writer to review high-risk controlled documents:

- Safety warnings.
- Security procedures.
- Destructive migration procedures.
- Recovery procedures.
- User-facing compliance claims.
- The project terminology file.

## 14. Research conclusion

STE can improve agent skills because it reduces lexical and structural ambiguity.

STE cannot make an incorrect engineering instruction correct. The skill must combine clear language with accurate domain rules and observed evidence.

