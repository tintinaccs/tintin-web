#!/usr/bin/env bash
# Descarga el SDK de Firebase a artifacts/fbmirror para que
# scripts/auditar-rendimiento-metricas.mjs pueda medir el costo real de tener Firebase
# en el camino crítico, sirviéndolo con la misma latencia simulada que el
# resto del sitio.
#
# Sin este espejo la medición corta los pedidos a gstatic y el tramo de
# Firebase queda fuera del número, que es justo el que más pesa.
set -euo pipefail

VERSION="${1:-10.14.1}"
BASE="https://www.gstatic.com/firebasejs/${VERSION}"
DEST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/artifacts/fbmirror"

mkdir -p "$DEST"
for file in firebase-app.js firebase-firestore.js firebase-auth.js firebase-app-check.js; do
  curl -fsS "${BASE}/${file}" -o "${DEST}/${file}"
  printf '%s: %s bytes\n' "$file" "$(stat -c%s "${DEST}/${file}")"
done
echo "Espejo listo en artifacts/fbmirror (versión ${VERSION})."
