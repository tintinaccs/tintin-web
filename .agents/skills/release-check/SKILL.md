---
name: release-check
description: Use before releasing Tintin Web to production. Perform evidence-based release readiness checks using the repository's existing targeted and final audits, identify true blockers, avoid speculative work, and return a concise READY/BLOCKED decision.
---

# Release Check

Perform release-readiness verification without changing production configuration unless explicitly requested.

1. Inspect the change scope and current repository state first.
2. Select existing tests/audits proportional to the release scope. Use targeted checks for narrow changes; use broader/final audits for full release readiness.
3. Verify applicable critical flows: catalog, cart, orders, inventory, users/auth/roles, Firestore rules, admin/public sync, responsive UI, security, performance and production configuration.
4. Distinguish failures caused by the candidate changes from pre-existing/unrelated failures when evidence allows.
5. Do not claim a check passed unless it actually completed successfully.
6. Return one decision: READY, READY WITH NON-BLOCKING ISSUES, or BLOCKED.
7. List only real blockers/non-blockers with evidence and the minimum action required.