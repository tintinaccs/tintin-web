---
name: fix-bug
description: Use when fixing a specific Tintin Web defect. Trace the root cause, make the smallest complete production-quality change, validate the affected path, avoid unrelated refactors, and report only verified results.
---

# Fix Bug

1. Reproduce or establish the failure from concrete evidence.
2. Trace the shortest relevant code/data/configuration path to the root cause.
3. Do not broaden scope unless required to fix that root cause.
4. Implement the smallest complete, maintainable fix using existing project patterns.
5. Run the narrowest relevant verification first; use broader checks only when the change's impact justifies them.
6. Review the final diff for regressions, accidental edits, security weakening, and scope creep.
7. Report: root cause, changed locations, verification actually run, and any real unresolved limitation. Do not narrate routine steps.