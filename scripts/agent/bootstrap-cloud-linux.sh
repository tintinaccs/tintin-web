#!/usr/bin/env bash
# Installs repo-scoped Skills ONLY into an explicitly specified Linux cloud prefix.
# No downloads, no package installs, no code from third-party skills executed.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
if [[ "${1:-}" == "--check" ]]; then
  python3 "$repo_root/scripts/agent/check-cloud-skills.py"
  exit 0
fi
if [[ "${1:-}" != "--prefix" || -z "${2:-}" ]]; then
  echo "Usage: bash scripts/agent/bootstrap-cloud-linux.sh --check" >&2
  echo "   or: bash scripts/agent/bootstrap-cloud-linux.sh --prefix <absolute-ephemeral-cloud-directory>" >&2
  exit 2
fi
prefix="$2"
if [[ "$prefix" != /* || "$prefix" == "/" || "$prefix" == "$HOME" ]]; then
  echo "Use an explicit absolute isolated temporary Linux cloud directory, not / or HOME." >&2
  exit 2
fi
python3 "$repo_root/scripts/agent/check-cloud-skills.py"
for agent in ".agents" ".claude"; do
  source_dir="$repo_root/$agent/skills"
  destination="$prefix/$agent/skills"
  if [[ -e "$destination" ]]; then
    echo "Refusing to overwrite existing Skills at $destination" >&2
    exit 3
  fi
  mkdir -p "$(dirname "$destination")"
  cp -R "$source_dir" "$destination"
  echo "Installed $agent repo Skills into ephemeral Linux path: $destination"
done
echo "No dependency packages installed; no external scripts executed."
