# Technical Writing Rules

## 1. Standard

Use an ASD-STE100-aligned style when ambiguity can cause operational, security, data, or recovery risk.

Do not apply this style as a global requirement. Ordinary discussion, research, brainstorming, and low-risk text can use natural language.

ASD-STE100 Issue 9 was published on 2025-01-15. ASD owns the standard and its trademark. The official standard has writing rules and a controlled dictionary.

Sources:

- [ASD-STE100 official site](https://asd-ste100.org/)
- [ASD Simplified Technical English](https://www.asd-europe.org/standards-specifications/simplified-technical-english/)

The skill's applied guidance is in
[writing reference](../skills/rivet/references/writing.md).

## 2. Compliance statement

Do not state that project text complies with ASD-STE100 unless:

1. The writer or reviewer uses the official current issue.
2. The approved vocabulary is checked.
3. A qualified review or approved checker validates the text.

Use this statement for current project documents:

> This document uses an ASD-STE100-aligned technical writing style. It is not a certified ASD-STE100 document.

The project must not copy or redistribute the controlled dictionary without permission.

## 3. Writing rules

Use these working rules:

- Use one term for one meaning.
- Use one meaning for one term.
- Use the active voice when the actor is important.
- Identify the actor.
- Use short sentences.
- Put one main instruction in one sentence.
- Put conditions before the action.
- Use lists for a sequence or a set.
- Use an imperative verb for an instruction.
- Use a descriptive sentence for information.
- Do not omit words to make text shorter.
- Do not use idioms.
- Do not use humor in safety or security instructions.
- Do not use vague modifiers.
- Do not use marketing words in technical requirements.
- Define each abbreviation at its first use.
- Use approved domain terms consistently.
- Use positive instructions when possible.
- State warnings before the related instruction.
- Make references specific.

## 4. Preferred forms

Preferred:

> Run the test in the isolated environment.

Not preferred:

> The test should probably be run somewhere safe.

Preferred:

> If the migration fails, stop the deployment.

Not preferred:

> Stop the deployment in the event that the migration might happen to fail.

Preferred:

> The scanner did not inspect the production authorization policy.

Not preferred:

> Authorization looks fine, but the scanner may not have seen everything.

## 5. Requirement words

Use:

- **must** for a required condition.
- **must not** for a prohibited condition.
- **should** for a recommendation with permitted exceptions.
- **can** for capability.
- **may** for permission.

Do not use “shall” unless a contract or adopted standard requires it.

## 6. Finding format

Use this order:

1. Condition.
2. Evidence.
3. Effect.
4. Required action.
5. Verification.
6. Limitation.

Example:

> The order worker retries the payment request three times. The payment request does not have an idempotency key. A retry can create more than one charge. Add a stable idempotency key for one order attempt. Test a lost response after the payment provider completes the charge. The test does not prove the behavior of the production provider.

## 7. Documentation check

Add a documentation check that finds:

- Long sentences.
- Undefined abbreviations.
- Passive instructions.
- Different terms for the same object.
- Vague words.
- Missing actors.
- Mixed instruction and description.
- Unsupported compliance claims.

The check can help a writer. It cannot certify ASD-STE100 compliance.

