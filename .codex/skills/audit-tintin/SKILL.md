---
name: audit-tintin
description: Use for comprehensive read-only audits of Tintin Web. Review only relevant production concerns with concrete repository evidence, classify findings by severity, avoid speculative missing features, and do not modify code unless separately asked.
---

# Audit Tintin

Perform a read-only production audit. Do not modify files.

1. Establish the actual stack, architecture, runtime paths, integrations, and existing tests/audits from repository evidence.
2. Review applicable areas only: business logic, CRUD completeness, catalog/cart/orders, Firebase/Firestore, auth/roles, data integrity, security, performance, responsive UI, accessibility, SEO, integrations, configuration, deployment, tests and production readiness.
3. Reuse targeted existing audit scripts where they materially improve evidence. Do not run every audit by default.
4. For every finding require concrete evidence. Do not report hypothetical concerns as defects.
5. Classify each item: CRITICAL, HIGH, MEDIUM, LOW, CORRECT, or NOT APPLICABLE.
6. For actual problems report: location, evidence, impact, minimal recommended correction.
7. Stop once the requested audit scope has sufficient evidence. Keep the final report concise and prioritized.