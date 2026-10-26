# Addy Osmani agent-skills audit

Research date: 2026-10-26.

Repository: `https://github.com/addyosmani/agent-skills`

Reviewed revision:
`aeac41d4d005999432bb7312f7ff06383a91d59d`

License: MIT.

## Provenance

The reviewed revision has 702 commits. Addy Osmani is the principal
contributor in the local shortlog. The repository also has many named
contributors, a contribution process, a source history, and public issue and
pull-request workflows.

The repository contains:

- 25 skills.
- Four agent personas.
- Nine lifecycle commands.
- 25 deterministic routing case files.
- Behavioral evaluation fixtures.
- Hook implementations and regression tests.
- Host-specific installation guidance.
- Cross-platform continuous-integration checks.

Repository popularity is an adoption signal. It is not evidence that a
technical rule is correct.

## Verification performed

The following checks passed at the reviewed revision with Node.js 22.22.0:

- Skill validation: 25 skills and four personas, zero errors and warnings.
- Skill-lint unit tests: 74 passed.
- Deterministic routing: 143 checks passed.
- Positive routing rank: 91 of 91 prompts ranked their declared skill first.
- Validator and evaluation-runner tests: 139 passed.
- Reference-link, artifact-path, command-parity, and version checks passed.
- Session-start hook regression: passed.
- Source-driven-development cache hooks: 29 assertions passed.
- Simplification-protection hooks: 64 assertions passed.

The paid behavioral evaluations were not run. The routing score uses a local
lexical model. It does not prove semantic host routing or skill adherence.

## Strong patterns to adopt

### Test skill routing and behavior separately

The repository separates:

- Structural validation.
- Deterministic trigger and routing checks.
- Paid behavioral evaluation.

This is better than using one model-based score for all three concerns. Rivet
should add deterministic package validation and maintain native behavioral
evaluation as a separate evidence class.

### Ratchet quality rules

The constraint workflow distinguishes:

- A minimum floor.
- Measured current values.
- Enforced numeric limits.
- Expiring exceptions.

Its floor guard detects weakened thresholds, new suppressions, removed
assertions, skipped or deleted tests, and new exceptions. Rivet should adopt
the ratchet concept, but it must discover repository tools before it proposes
new tools or universal thresholds.

### Keep a rejection ledger

The repository records skill changes that evaluation evidence rejected. This
prevents maintainers from repeating a plausible change after its original
branch disappears.

Rivet should record rejected guidance and description changes with:

- The affected revision.
- The hypothesis.
- The evaluation method.
- Before and after results.
- The rejection reason.
- Conditions that justify a new trial.

### Treat descriptions as tested interfaces

The routing cases contain positive and negative user prompts. Negative cases
name the adjacent skill that should own the request. This tests overlap, not
only keyword presence.

Rivet should test its description against backend requests and adjacent
frontend, generic writing, and non-engineering requests.

### Test host wrappers for drift

The repository checks command parity, manifest versions, artifact paths,
frontmatter, and reference links across host surfaces. This supports Rivet's
canonical-source rule and suggests more validation than byte-copy checks
alone.

### Preserve pressure cases

Behavioral fixtures include time pressure, authority pressure, and requests
to skip verification. These cases test whether a workflow survives the
conditions that cause agents to bypass it.

Rivet should add such cases to its blind evaluation campaign.

## Patterns to adapt carefully

### Mandatory meta-routing

The repository's meta-skill uses absolute rules such as invoking a skill when
there is even a small chance that it applies. This can improve consistency in
its intended host, but it can also over-trigger, add process to small tasks,
and conflict with a host's native router.

Rivet will keep risk-based routing. It must not require every workflow for
every backend change.

### Fixed numeric defaults

Some skills contain general numbers for test ratios, coverage, password
hashing, rate limits, context use, and other controls. These can be useful
examples, but they are not universal standards.

Rivet will require a project source, measurement, or selected policy before it
uses a number as a gate. It can present an external number as a dated example
with its source and applicability.

### Large entry-point skills

Several entry points include extensive procedures, rationalization tables,
red flags, and verification lists. This makes the workflow self-contained but
increases activation cost.

Rivet will keep conditional detail in references and load only the relevant
database, security, testing, systems, or writing reference.

### Shared references

The repository documents that single-skill installation can omit shared
references. A skill can then load without material that its procedure expects.

Rivet host packages must include every referenced file. Package validation
must fail on a missing local reference.

### Tool installation from prose

The constraint skill recommends established tools and gives install commands.
This is appropriate only after project selection and authorization.

Rivet will continue to discover existing repository tools first. It must not
install a new tool merely because an external skill recommends it.

## Patterns rejected

- Popularity as proof of technical correctness.
- One mandatory lifecycle for all changes.
- Universal security, performance, or coverage numbers without project
  evidence.
- A model-generated behavioral grade as the only acceptance gate.
- Host-specific workarounds in the canonical engineering doctrine.
- A security checklist as proof that a system is secure.
- Compliance claims from engineering guidance without qualified review.

## Rivet work created by this audit

1. Add portable skill-package and reference-link validation. Complete.
2. Add positive, negative, and pressure cases for Rivet activation. Complete
   for the deterministic contract; native host evaluation remains separate.
3. Add a skill-change rejection ledger. Complete.
4. Add quality-ratchet evidence without automatic tool installation.
5. Extend host-package tests to detect canonical-guidance drift. Complete.
