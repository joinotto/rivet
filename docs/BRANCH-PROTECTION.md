# Branch protection

Observed on 2026-10-26.

Protected branch: `main`

## Enforced controls

- Require the pull-request path.
- Require the branch to be current before merge.
- Require successful `Node.js 16`, `Node.js 22`, `Analyze JavaScript`,
  `Dependency vulnerability diff / osv-scan`, and
  `Backend risk and evidence` checks from GitHub Actions.
- Dismiss stale review state after a new push.
- Require resolution of review conversations.
- Require linear history.
- Apply protection to repository administrators.
- Prohibit force pushes.
- Prohibit branch deletion.

## Current review limitation

The project has one named maintainer. GitHub does not permit an author to
approve the author's own pull request. The required approval count is
temporarily zero so the project can use the protected pull-request and CI path
without a false self-review.

This setting does not make an unreviewed change independently reviewed.
Security-sensitive release code must not ship without the approvals required
by `GOVERNANCE.md` and `RELEASING.md`.

Increase the required approval count to at least one when a second qualified
maintainer or regular independent reviewer is available. Record that change in
this file and the repository history.

## Verification

The repository branch-protection API reported:

- Strict required status checks enabled.
- Required checks: `Node.js 16`, `Node.js 22`, `Analyze JavaScript`,
  `Dependency vulnerability diff / osv-scan`, and
  `Backend risk and evidence`.
- Pull-request review protection enabled.
- Required approval count: zero.
- Administrator enforcement enabled.
- Linear history enabled.
- Conversation resolution enabled.
- Force pushes disabled.
- Deletion disabled.

Repository settings are mutable external state. Recheck them before a public
release and during a security review.
