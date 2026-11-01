#!/usr/bin/env bash
# Valida/instala Skills de Tintín en un entorno Linux efímero de agente.
# Sin sudo, sin descargas, sin dependencias ni efectos sobre la tienda.
set -Eeuo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  printf 'Este comprobador está destinado a Linux (nube).\n' >&2
  exit 2
fi

MODE="${1:---check}"
if [[ "$MODE" != "--check" && "$MODE" != "--install-user" ]]; then
  printf 'Uso: bash scripts/check-cloud-skills-linux.sh [--check|--install-user]\n' >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TOTAL=0

for TARGET in codex claude; do
  case "$TARGET" in
    codex) REPO_DIR="$ROOT/.agents/skills"; USER_DIR="$HOME/.agents/skills";;
    claude) REPO_DIR="$ROOT/.claude/skills"; USER_DIR="$HOME/.claude/skills";;
  esac

  if [[ ! -d "$REPO_DIR" ]]; then
    printf 'Falta directorio %s\n' "$REPO_DIR" >&2
    exit 1
  fi

  COUNT=0
  for DIR in "$REPO_DIR"/*; do
    [[ -d "$DIR" ]] || continue
    FILE="$DIR/SKILL.md"
    [[ -f "$FILE" ]] || { printf 'Falta %s\n' "$FILE" >&2; exit 1; }
    [[ "$(head -n 1 "$FILE")" == "---" ]] || {
      printf 'Frontmatter inicial ausente: %s\n' "$FILE" >&2
      exit 1
    }
    grep -q '^name: ' "$FILE" || { printf 'Falta name: %s\n' "$FILE" >&2; exit 1; }
    grep -q '^description: ' "$FILE" || { printf 'Falta description: %s\n' "$FILE" >&2; exit 1; }
    COUNT=$((COUNT + 1))

    if [[ "$MODE" == "--install-user" ]]; then
      mkdir -p "$USER_DIR"
      DEST="$USER_DIR/$(basename "$DIR")"
      if [[ -L "$DEST" ]] && [[ "$(readlink -f "$DEST")" == "$(readlink -f "$DIR")" ]]; then
        : # Ya enlazado a este mismo repo
      elif [[ -e "$DEST" || -L "$DEST" ]]; then
        printf 'Aviso: conservo Skill de usuario ya existente: %s\n' "$DEST" >&2
      else
        ln -s "$DIR" "$DEST"
      fi
    fi
  done
  [[ "$COUNT" -gt 0 ]] || { printf 'Sin Skills en %s\n' "$REPO_DIR" >&2; exit 1; }
  TOTAL=$((TOTAL + COUNT))
  printf '%s: %s Skills comprobados (%s).\n' "$TARGET" "$COUNT" "$MODE"
done

for FILE in \
  "$ROOT/.agents/skills/taste-frontend/library/sites.json" \
  "$ROOT/.claude/skills/taste-frontend/references/copy.md" \
  "$ROOT/.agents/skills/ui-ux-pro-max/scripts/search.py" \
  "$ROOT/.claude/skills/ui-ux-pro-max/data/ux-guidelines.csv" \
  "$ROOT/.agents/skills/frontend-design/LICENSE.txt"; do
  [[ -s "$FILE" ]] || { printf 'Recurso crítico ausente: %s\n' "$FILE" >&2; exit 1; }
done

printf 'OK: %s directorios de Skills verificados en total. No se ha ejecutado código de terceros.\n' "$TOTAL"
if [[ "$MODE" == "--install-user" ]]; then
  printf 'Enlaces de usuario creados solo si no existían. El checkout de este repositorio debe permanecer disponible.\n'
fi
