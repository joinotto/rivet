# Technical Writing

Use this reference when you write a procedure, warning, finding, runbook, change record, or evidence report.

Use the Rivet ASD-STE100-aligned profile:

- Use one term for one meaning.
- Identify the actor when the actor is important.
- Use the imperative form for instructions.
- Put conditions before actions.
- Put one principal instruction in one sentence.
- Use active voice when possible.
- Define abbreviations at first use.
- Put warnings before dangerous actions.
- Use `must` for requirements.
- Use `must not` for prohibitions.
- Use `can` for capability.
- Use `may` for permission.

Keep procedural sentences at 20 words or fewer when practical.

Keep descriptive sentences at 25 words or fewer when practical.

Do not change:

- Code.
- API identifiers.
- Direct quotations.
- Required legal text.
- Precise technical terms.

Run the checker:

```sh
node "<skill-dir>/scripts/rivet-ste.mjs" <file-or-directory>
```

The checker finds deterministic faults and heuristic warnings. It does not certify ASD-STE100 compliance.

For the complete policy, read `docs/ASD-STE100-FOR-SKILLS.md` in the Rivet repository.

