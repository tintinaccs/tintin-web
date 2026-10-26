#!/usr/bin/env bash
set -euo pipefail

# Sólo prepara el runner efímero; no instala paquetes ni omite validaciones.
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux ]]; then
  echo 'Esta preparación sólo se ejecuta en runners Linux de GitHub Actions.' >&2
  exit 1
fi

sudo tee /etc/apt/apt.conf.d/80tintin-ci-network >/dev/null <<'APT'
Acquire::Retries "2";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
APT

# El mirror regional HTTP dejó apt-get update sin progreso hasta el timeout
# del job. Conservamos suites, firmas y claves; sólo cambia el transporte/mirror.
for source in /etc/apt/apt-mirrors*.txt /etc/apt/sources.list /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
  [[ -f "$source" ]] || continue
  sudo sed -i \
    -e 's#https\?://azure[.]archive[.]ubuntu[.]com/ubuntu#https://archive.ubuntu.com/ubuntu#g' \
    -e 's#http://archive[.]ubuntu[.]com/ubuntu#https://archive.ubuntu.com/ubuntu#g' \
    -e 's#http://security[.]ubuntu[.]com/ubuntu#https://security.ubuntu.com/ubuntu#g' \
    "$source"
done
echo 'APT: mirrors oficiales HTTPS y tiempos de red acotados; verificación de firmas conservada.'
