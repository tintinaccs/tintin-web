---
name: tintin-security-hardening
description: Use for auth, authorization, XSS, CSP, dependency or secrets audits and secure deployment changes in Tintín.
---

# tintin-security-hardening

Review repo's actual architecture, AGENTS.md and existing security tests. Focus on auth boundaries, account roles, Firestore rules, checkout/order integrity, input validation, CSP/headers, secrets, supply chain, CI permissions and endpoint abuse controls. Do not add invasive scanners to runtime or send secrets to third parties. Report evidence and severity; use smallest secure correction; verify negative permission tests. Distinguish public client config from real secrets. No bypassing branch protection or destructive production operations.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
