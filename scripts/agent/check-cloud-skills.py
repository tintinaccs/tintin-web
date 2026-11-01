#!/usr/bin/env python3
"""Read-only validation of repo-scoped agent Skills. Python standard library only."""
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PREFIXES = [".agents/skills", ".claude/skills"]
REQUIRED = {
    "design-taste-frontend", "ui-ux-pro-max", "ponytail", "caveman",
    "code-review", "handoff", "systematic-debugging",
    "verification-before-completion", "frontend-design", "webapp-testing",
}
CUSTOM = {
    "tintin-brand-copy", "tintin-design-quality", "tintin-performance-budgets",
    "tintin-accessibility", "tintin-ecommerce-flows", "tintin-firebase-integrity",
    "tintin-security-hardening", "tintin-search-seo", "tintin-integrations",
    "tintin-cloud-linux", "tintin-tests-evidence", "tintin-agent-efficiency",
    "tintin-maintainability", "tintin-observability", "tintin-code-index", "tintin-release-operations",
}
# Folder aliases intentionally differ for some imported skill names.
ALIASES = {"design-taste-frontend": "taste-frontend",
           "code-review": "matt-code-review", "handoff": "matt-handoff"}
errors = []
seen = {}
for prefix in PREFIXES:
    folder = ROOT / prefix
    if not folder.is_dir():
        errors.append(f"Missing: {prefix}")
        continue
    items = {}
    for skill in sorted(folder.iterdir()):
        if not skill.is_dir():
            continue
        file = skill / "SKILL.md"
        if not file.is_file():
            errors.append(f"Missing SKILL.md: {file.relative_to(ROOT)}")
            continue
        data = file.read_text(encoding="utf-8")
        if not data.startswith("---\n"):
            errors.append(f"Invalid frontmatter: {file.relative_to(ROOT)}")
            continue
        first = data.split("\n---\n", 1)[0].splitlines()[1:]
        names = [line.split(":", 1)[1].strip().strip('"') for line in first if line.startswith("name:")]
        desc = [line for line in first if line.startswith("description:")]
        if len(names) != 1 or not names[0] or not desc:
            errors.append(f"Missing name or description: {file.relative_to(ROOT)}")
            continue
        if names[0] in items:
            errors.append(f"Duplicate Skill name: {names[0]} in {prefix}")
        items[names[0]] = str(file.relative_to(ROOT))
    expected = REQUIRED | CUSTOM
    for name in sorted(expected - items.keys()):
        errors.append(f"Missing expected Skill {name} in {prefix}")
    seen[prefix] = items
    print(f"{prefix}: {len(items)} Skills with valid file metadata")
for name in REQUIRED | CUSTOM:
    if name in seen.get(PREFIXES[0], {}) and name in seen.get(PREFIXES[1], {}):
        a = (ROOT / seen[PREFIXES[0]][name]).read_text(encoding="utf-8")
        b = (ROOT / seen[PREFIXES[1]][name]).read_text(encoding="utf-8")
        if a != b:
            errors.append(f"Mismatched Codex and Claude Skill: {name}")
checks = [
    ".agents/skills/taste-frontend/scripts/draw.mjs",
    ".claude/skills/taste-frontend/references/copy.md",
    ".agents/skills/ui-ux-pro-max/scripts/search.py",
    ".claude/skills/ui-ux-pro-max/data/styles.csv",
    ".agents/skills/systematic-debugging/root-cause-tracing.md",
    "docs/agent/CLOUD_SKILLS_CATALOG.md",
]
for path in checks:
    if not (ROOT / path).is_file():
        errors.append(f"Missing auxiliary file: {path}")
if errors:
    for msg in errors:
        print("ERROR:", msg, file=sys.stderr)
    raise SystemExit(1)
print("PASS: file metadata, required paths and selected Codex/Claude parity (native host discovery not tested)")
