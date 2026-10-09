// GitHub publica este historial en repositorios públicos. La lectura no concede
// aprobación: validateApproval sigue comprobando entorno, estado y revisor.
export async function readPublicApprovals(repository, runId, fetchImpl = fetch) {
  if (repository !== 'tintinaccs/tintin-web' || !/^[1-9][0-9]*$/.test(String(runId))) {
    throw new Error('Repositorio o ejecución de aprobación inválidos.');
  }
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/actions/runs/${runId}/approvals`, {
    headers: { accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Historial público de aprobación rechazado: HTTP ${response.status}`);
  const reviews = await response.json();
  if (!Array.isArray(reviews)) throw new Error('Historial de aprobación inválido.');
  return reviews;
}
