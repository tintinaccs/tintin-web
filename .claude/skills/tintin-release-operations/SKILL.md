---
name: tintin-release-operations
description: Use for release readiness, GitHub Actions, pull requests, merge checks, safe deployment, rollback and incident continuity in Tintín.
---

# tintin-release-operations

Read AGENTS.md and docs/agent/GITHUB_RESULTS.md. For code-changing PRs, track head SHA, check IDs, runs/attempts, failures and merge status, then verify post-merge checks separately. Never bypass protections, assume an enabled auto-merge succeeded, run real customer transactions as smoke tests or trigger production deploy without authorization. Compare current deployment scripts and release markers. Separate rollback of code from nonreversible Firestore data migrations; record exact state and human blockers.

Respect AGENTS.md, DESIGN.md, security, privacy and production boundaries. Report concrete evidence, files, tests and limitations.
