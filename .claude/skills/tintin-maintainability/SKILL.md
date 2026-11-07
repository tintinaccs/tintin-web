---
name: tintin-maintainability
description: Use for correcting architecture, duplicate implementations, generated files, event listeners, responsive CSS conflicts and tech debt in Tintín.
---

# tintin-maintainability

Trace canonical ownership from actual callers and docs/arquitectura-versiones-canonicas.md. Prefer simplifying existing modules to adding abstractions or frameworks. Do not create parallel catalog/search/checkout implementations, manual edits to generated artifacts, new global CSS overrides or broad reformats. Preserve public contracts and current deployed data semantics. Include a rollback plan for high-risk changes and minimal tests for touched consumers.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
