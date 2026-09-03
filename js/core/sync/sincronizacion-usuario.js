// TINTIN — disparador único de réplica inmediata del perfil canónico.
//
// Firestore sigue siendo la autoridad. Este helper se llama DESPUÉS de que
// una escritura de users/{uid} terminó correctamente. No manda datos de
// perfil: el endpoint server-side relee Firestore y replica esa versión.

export async function pushUserProfileToMirrors(user) {
  if (!user || user.isAnonymous || typeof user.getIdToken !== 'function') {
    return { ok: false, skipped: true, reason: 'missing_authenticated_user' };
  }
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/user-sync-push', {
      method: 'POST',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok !== true) throw new Error(result?.error || `HTTP ${response.status}`);
    return result;
  } catch (error) {
    // Nunca convierte una escritura válida de Firestore en un error visible.
    // El reconciliador periódico recupera la réplica si Google/Red falló.
    console.warn('[user-sync] Push inmediato diferido:', error);
    return { ok: false, deferred: true };
  }
}

export function pushUserProfileToMirrorsSoon(user) {
  void pushUserProfileToMirrors(user);
}
