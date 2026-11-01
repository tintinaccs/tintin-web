# Cloud checks and skill efficiency

These repo-scoped skills are loaded lazily by compatible cloud agents. Do not activate all skills simultaneously. Use `python3 scripts/agent/check-cloud-skills.py` for read-only discovery validation and `bash scripts/agent/bootstrap-cloud-linux.sh --check` for Linux setup inspection. The checkout itself exposes project skills; installation into an isolated runner is optional. Never bypass the repository CI or edit canonical generated manifests by hand.
