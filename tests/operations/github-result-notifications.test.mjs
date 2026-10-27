import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('terminal results preserve attempt, deduplicate and publish to the associated PR', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'github-results-'));
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const comments = [];
  try {
    process.env.GITHUB_EVENT_PATH = join(directory, 'event.json');
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GH_TOKEN = 'fixture-token';
    delete process.env.GITHUB_STEP_SUMMARY;
    globalThis.fetch = async (url, options) => {
      assert.ok(String(url).startsWith('https://api.github.com/repos/owner/repo/issues/7/comments'));
      if (options.method === 'POST') {
        const comment = JSON.parse(options.body);
        comments.push({ ...comment, user: { login: 'github-actions[bot]' } });
        return Response.json(comment);
      }
      return Response.json(comments);
    };
    for (const [index, conclusion] of ['failure', 'failure', 'success'].entries()) {
      writeFileSync(process.env.GITHUB_EVENT_PATH, JSON.stringify({ workflow_run: {
        id: 12, run_attempt: index === 2 ? 2 : 1, conclusion,
        html_url: 'https://github.com/owner/repo/actions/runs/12',
        name: 'CI', head_sha: 'abc', pull_requests: [{ number: 7 }],
      } }));
      await import(`../../scripts/notificar-resultados-github.mjs?case=${index}`);
    }
    assert.equal(comments.length, 2);
    assert.match(comments[0].body, /\*\*failure\*\*/);
    assert.match(comments[1].body, /github-result:12:2/);
    assert.match(comments[1].body, /\*\*success\*\*/);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    rmSync(directory, { recursive: true });
  }
});
