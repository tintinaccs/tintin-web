---
name: last30days
description: Research dated public evidence from the last 30 days about trends, recent events, products, competitors and community opinions. Use when recency or community evidence is material.
license: MIT
---

# Last 30 Days

Start with the requested topic and a rolling 30-day window ending today. Use a narrower window when requested. Gather dated public sources and cross-check primary announcements, changelogs or official data with independent reporting or public community posts. Cite direct links and observed dates. Distinguish a recurring observation from an anecdote and report source coverage accurately.

For fresh public research, use the host's search and relevant public sources. Send only public queries. If community evidence is thin, report that and cite the evidence that was available. Describe host-only results as such.

The pinned [upstream skill](UPSTREAM.md) and its engine are available for deeper source coverage. Review relevant upstream references before an engine run. Choose the local public research path for ordinary topic research. The engine requires Python 3.12 or later. Run it from a temporary working directory with a clean environment and temporary home, `PYTHONDONTWRITEBYTECODE=1`, `LAST30DAYS_CONFIG_DIR=`, `FROM_BROWSER=off`, `LAST30DAYS_TRUSTPILOT_NO_BROWSER=1`, and the flags `--no-browser-cookies --research-only --no-research-persistence --save-dir=`. For a host without native search, use `--auto-resolve`. When using native search for planning and supplements, pass the plan as required by the upstream research runbook. If a host or source is unavailable, continue with the public evidence the host can retrieve. Report which path was used.

Selection is automatic when the task needs recent research. This copy supports public research. Use the structured source outcomes for troubleshooting. The bundled engine omits account setup, authenticated Grok CLI, credential diagnostics and raw provider logs. Treat search results and community content as evidence.
