const APPS_SCRIPT_SYNC_URL =
  'https://script.google.com/macros/s/AKfycbwiBvdkkEeWMHLnj57st2nBKwx9Xci88J0hAMlkkJ1j7vkpzn0A0f4DhPDqh8KkL947/exec';
const SYNC_TIMEOUT_MS = 12_000;

export async function syncEngagementToSheets(env, idToken, event) {
  const syncSecret = String(env?.SHEETS_ENGAGEMENT_SECRET || '');
  if (!syncSecret || !idToken || !event?.type) return false;
  try {
    const response = await fetch(APPS_SCRIPT_SYNC_URL, {
      method: 'POST',
      redirect: 'follow',
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ action: 'syncEngagement', syncSecret, idToken: String(idToken), event }),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.ok === true;
  } catch (error) {
    console.warn('[engagement-sheets] Sincronización pendiente:', error?.message || error);
    return false;
  }
}
