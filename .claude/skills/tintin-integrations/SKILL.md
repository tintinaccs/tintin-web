---
name: tintin-integrations
description: Use for API, Cloudflare, Firebase, Cloudinary, external services, webhooks and synchronization contracts in Tintín.
---

# tintin-integrations

Inventory each integration from real code/config. Verify authentication, rate limits, schema validation, pagination, retries, idempotency, timeouts, CORS/CSP, error paths, cache invalidation and observability where applicable. Do not create new external service accounts or deploy secret config. Mock external calls in tests; never send real orders, WhatsApp messages, emails or payments as a dry-run. Reuse canonical env/config and document expected failure/rollback paths.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
