---
name: tintin-ecommerce-flows
description: Use for catalog, product variants, inventory, cart, checkout, payments, shipping, orders, returns and profile flows in Tintín.
---

# tintin-ecommerce-flows

Inspect real routes, canonical modules and contracts; do not model a generic e-commerce app. Protect variant/stock/price synchronization, checkout totals, order lifecycle and permissions. Use optimistic UI only for reversible actions with rollback; keep purchase confirmation server-authoritative. Prevent duplicate orders using transaction-safe idempotency where appropriate; never fabricate success or force navigation to a completed checkout. Validate delivery/pickup/encomienda and configured payment choices against actual settings. Never run real purchases, send customer messages or mutate production data as a test.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
