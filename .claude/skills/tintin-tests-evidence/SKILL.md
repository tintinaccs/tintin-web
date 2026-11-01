---
name: tintin-tests-evidence
description: Use for targeted test planning, visual regression, Playwright checks and reproducible validation of Tintín changes.
---

# tintin-tests-evidence

Read tests and existing playwright configs before making new ones. Pick smallest test scope matching changed code and user action, then expand on evidence of cross-module risk. Test success, failure, empty/loading, responsive, navigation, role permissions and concurrency when applicable. Do not run production writes or report PASS without recorded tool output and commit SHA. Prefer testable user behavior over screenshots alone; state unavailable browser/runtime coverage clearly.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
