---
name: token-efficient
description: Reduce context and token use during long coding, debugging, research, and handoff tasks by reading selectively and preserving compact evidence and decisions.
license: MIT
---

# Token Efficient

Use this as a working method when repository exploration, large outputs, or repeated validation would consume significant context. Follow the user's requested level of detail and Tintín's existing engineering and verification rules.

- Search for the relevant symbols, routes and contracts. Read targeted ranges first, then read complete files when understanding their behavior requires it.
- Group independent reads, avoid re-reading unchanged material, and keep broad command output in a temporary log. Read enough failures, diffs and evidence to verify the result.
- Before a long handoff or context limit, record the objective, decisions, paths, commit, exact checks, outcomes, and pending work. Reuse that summary while its evidence is current.
- Keep the answer concise and preserve necessary reasoning, source links, test results, and limits. Keep code, comments and user-facing tone appropriate to the task.

[Original upstream rules](references/RULES.md) are available as reference. This project adaptation applies the efficiency practices as needed alongside `tintin-agent-efficiency`.
