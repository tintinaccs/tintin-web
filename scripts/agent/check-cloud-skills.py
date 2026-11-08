#!/usr/bin/env python3
"""Read-only validation of repo-scoped agent Skills. Python standard library only."""
import hashlib
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PREFIXES = [".agents/skills", ".claude/skills"]
REQUIRED = {
    "design-taste-frontend", "ui-ux-pro-max", "ponytail", "caveman",
    "code-review", "handoff", "systematic-debugging",
    "verification-before-completion", "frontend-design", "webapp-testing", "gh-fix-ci",
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
    if name not in seen.get(PREFIXES[0], {}) or name not in seen.get(PREFIXES[1], {}):
        errors.append(f"Missing mirror Skill: {name}")
    if name in seen.get(PREFIXES[0], {}) and name in seen.get(PREFIXES[1], {}):
        a = (ROOT / seen[PREFIXES[0]][name]).read_text(encoding="utf-8")
        b = (ROOT / seen[PREFIXES[1]][name]).read_text(encoding="utf-8")
        if a != b:
            errors.append(f"Mismatched Codex and Claude Skill: {name}")
# Validate every auxiliary file, not just selected SKILL.md files.
for prefix in PREFIXES:
    root = ROOT / prefix
    for file in root.rglob("*"):
        imported = file.relative_to(root).parts[0]
        if file.is_file() and (imported in {"impeccable", "taste-frontend", "pya", "build-design"} or imported.startswith(("emil-", "better-"))):
            mirror = ROOT / PREFIXES[1 if prefix == PREFIXES[0] else 0] / file.relative_to(root)
            if not mirror.is_file() or mirror.read_bytes() != file.read_bytes():
                errors.append(f"Missing or mismatched mirrored resource: {file.relative_to(ROOT)}")
lock = json.loads((ROOT / "docs/agent/design-skills-lock.json").read_text())
taste_file = ROOT / PREFIXES[0] / lock["taste"]["folder"] / "SKILL.md"
if hashlib.sha256(taste_file.read_bytes()).hexdigest() != lock["taste"]["skillSha256"]:
    errors.append("Taste SKILL.md differs from its recorded upstream version")
for relative, expected_hash in lock["taste"]["upstreamSha256"].items():
    file = taste_file.parent / relative
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != expected_hash:
        errors.append(f"Taste resource integrity mismatch: {relative}")
for item in lock["imports"]:
    if len(item["revision"]) != 40:
        errors.append(f"Unpinned design Skill: {item['folder']}")
    for relative, expected_hash in item["installedSha256"].items():
        file = ROOT / PREFIXES[0] / item["folder"] / relative
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != expected_hash:
            errors.append(f"Design Skill integrity mismatch: {item['folder']}/{relative}")
    for relative, upstream_hash in item["upstreamSha256"].items():
        if relative != "SKILL.md" and item["installedSha256"].get(relative) != upstream_hash:
            errors.append(f"Unexpected upstream resource modification: {item['folder']}/{relative}")
    if "LICENSE.upstream" not in item["installedSha256"]:
        errors.append(f"Missing upstream license: {item['folder']}")
agents_lock = lock.get("agents")
if agents_lock:
    if len(agents_lock["revision"]) != 40:
        errors.append("Unpinned PYA agents")
    agents_dir = ROOT / agents_lock["folder"]
    if not (agents_dir / agents_lock["license"]).is_file():
        errors.append("Missing PYA agents license")
    for name, expected_hash in agents_lock["sha256"].items():
        file = agents_dir / name
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != expected_hash:
            errors.append(f"PYA agent integrity mismatch: {name}")
checks = [
    ".agents/skills/taste-frontend/scripts/draw.mjs",
    ".claude/skills/taste-frontend/references/copy.md",
    ".agents/skills/ui-ux-pro-max/scripts/search.py",
    ".claude/skills/ui-ux-pro-max/data/styles.csv",
    ".agents/skills/systematic-debugging/root-cause-tracing.md",
    "docs/agent/CLOUD_SKILLS_CATALOG.md",
    ".agents/skills/gh-fix-ci/scripts/inspect_pr_checks.py",
    ".claude/skills/gh-fix-ci/LICENSE.txt",
]
for path in checks:
    if not (ROOT / path).is_file():
        errors.append(f"Missing auxiliary file: {path}")
if errors:
    for msg in errors:
        print("ERROR:", msg, file=sys.stderr)
    raise SystemExit(1)
print("PASS: file metadata, required paths/parity and all newly imported resources, pinned imports and licenses (native host discovery not tested)")
