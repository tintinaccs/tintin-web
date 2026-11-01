---
name: tintin-agent-efficiency
description: Use to reduce coding-agent token use, duplicated investigation, slow workflows, and needless re-analysis in Tintín.
---

# tintin-agent-efficiency

Before reading files, inspect AGENTS.md and docs/agent/README.md; search likely canonical paths, avoid scanning the entire repo by default. Summarize known facts, reuse existing docs/tests, batch related reads, cache paths and do not re-read unchanged blobs. Select 1-2 pertinent Skills per task, not every installed Skill; their metadata consumes context. Make small coherent diffs, run targeted checks first, and leave concise actionable handoffs with file paths, commit SHA, tests and remaining blockers. NEVER shorten away evidence, approvals, security checks or correctness for token savings.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
