---
name: tintin-cloud-linux
description: Use for GitHub Actions, Codex/Claude cloud Linux setup, safe dependency checks and reproducible agent Skills discovery in Tintín.
---

# tintin-cloud-linux

Work only in remote repository or authorized ephemeral cloud Linux runners; do not assume the owner's PC is available. Skills from .agents/skills and .claude/skills are repo-scoped and work after checkout. Use scripts/agent/bootstrap-cloud-linux.sh for optional copying into an ephemeral Linux agent home; execute only when authorized. Pin CI dependencies/actions, use minimal permissions and no secrets, avoid curl-to-shell or long-running daemons. Verify discovery, frontmatter and resources using scripts/agent/check-cloud-skills.py. Distinguish PR checks from an actual Codex/Claude runtime skill activation test.

## Completion evidence
Report files touched, targeted verification results, repository commit/PR when applicable, and explicit limits. This Skill never overrides AGENTS.md, DESIGN.md, or production safety rules.
