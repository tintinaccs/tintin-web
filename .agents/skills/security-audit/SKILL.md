---
name: security-audit
description: Use for authorized defensive security review of Tintin Web. Inspect Firebase/Firestore rules, auth, roles, admin actions, data exposure, validation, secrets and trust boundaries; report evidence-based findings without weakening controls or making unrelated changes.
---

# Security Audit

Read-only unless the user explicitly asks to fix findings.

1. Identify real trust boundaries and sensitive assets from the repository.
2. Review applicable areas: authentication, authorization/roles, Firestore rules, admin actions, user/order/inventory data, client/server trust, input validation, secrets/configuration, external integrations and error/data exposure.
3. Check for authorization gaps, overly broad reads/writes, client-trusted privileged fields, secret leakage, insecure defaults and validation at the wrong boundary.
4. Use existing security audits/tests when relevant. Do not weaken controls to satisfy tests.
5. Require concrete evidence for every finding; avoid speculative vulnerability claims.
6. Classify findings CRITICAL/HIGH/MEDIUM/LOW and include location, evidence, impact, and minimal remediation.
7. Explicitly mark reviewed areas that are correct or not applicable when useful to the requested scope.