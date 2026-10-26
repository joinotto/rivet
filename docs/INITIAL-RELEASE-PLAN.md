# Initial release plan

Observed on 2026-10-26.

Status: initial-use preparation. No public release.

## Scope

Support Codex and Claude Code only.

Keep backend reasoning, design, database, testing, security, and evidence
workflows in the canonical `skills/rivet/` source. Generate exactly two host
packages. Record the tested host version and operating profile for each claim.

Cursor and other host integrations are future work in `ROADMAP.md`. They do
not block the initial two-host release.

## Current evidence

- Codex and Claude Code can discover and invoke the Rivet skill.
- Both hosts have observed command, session, approval, and hook evidence.
- Codex has observed read-only and workspace-write sandbox evidence.
- Claude Code has observed tool-allowlist evidence.
- Mutating Claude Code automation passes only through the tested macOS
  external-sandbox profile.
- Package tests exercise repository inspection, selected checks, and redaction.
- Candidate builds have deterministic archives, a software bill of materials,
  source binding, and independent downloaded-artifact verification.
- The candidates remain unsigned.

See `docs/HOST-CONFORMANCE.md`, `docs/PHASE-1-CONFORMANCE.md`, and
`docs/RELEASE-CANDIDATE-CONFORMANCE.md`.

## Work sequence

| Step | Deliverable | Completion evidence |
| --- | --- | --- |
| 1 | Two-host distribution | Generator emits only Codex and Claude Code; verifier rejects other inventories |
| 2 | Project installation and removal | Fresh-project checks; existing files preserved; correct discovery paths |
| 3 | First-use guide | Users can invoke Rivet, inspect a repository, preview checks, and run a selected check |
| 4 | Two-host candidate | Clean-source build; reproducibility; downloaded-artifact verification |
| 5 | Controlled pilot | Real backend projects; recorded defects, false positives, usability, and recovery |
| 6 | Supported production release | Exact-revision gates, signatures, trust policy, qualified approvals, and release notes |

Continue signed commits and protected pull requests for each coherent increment.
Do not add another host before the initial installation and release workflows
are established.

## Initial-use decision

An installable preview requires steps 1 through 4 to pass. It must identify its
source revision, supported profiles, and limitations. A user must review
repository commands before execution.

The preview must not claim that a valid schema proves system safety, legal
compliance, implementation correctness, or production behavior.

## Production decision

Follow all release gates in `RELEASING.md`.

Retain the release revision, full continuous-integration results, dependency
scan, license review, security review, compatibility review, support record,
software bill of materials, provenance, signature verification, and required
independent approvals.

The responsible maintainer must select the release signer and trust policy.
Qualified reviewers must complete the required reviews. Automated tests and
agent reviews do not substitute for those human records.

The full roadmap retains its security, evaluation, and advanced-review exit
criteria. Narrowing host support does not mark those criteria complete.

## Planning estimate

These are planning estimates from the current repository state.

- First installable two-host preview: 1 to 3 focused workdays.
- Supported production release: 2 to 4 weeks if reviewer access, signing
  decisions, and pilot participants are available promptly.

Reassess the estimate after the pilot and independent review. An unresolved
release gate delays publication. The full roadmap has no verified completion
date while required human reviews and the human evaluation baseline are absent.
