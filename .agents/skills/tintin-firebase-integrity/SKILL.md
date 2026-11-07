---
name: tintin-firebase-integrity
description: Use for Firebase/Firestore data models, rules, transactions, indexes, migrations, listeners and synchronization issues.
---

# tintin-firebase-integrity

Map reads/writes and document shapes against actual firestore.rules, cloud functions and affected clients. Prefer server-enforced validation, least privilege, atomic transactions/batches as appropriate, idempotent retries, and safe index changes. Inspect pricing, stock, orders, roles and notifications for race conditions. Never relax rules to pass tests; never migrate live data without explicit approval and recovery plan. Verify targeted emulator or isolated tests, log what was not tested; no speculative missing-index claims.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
