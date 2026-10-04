const LABELS = { google: 'Google', emailOtp: 'Código por correo' };
export function accountAccessSummary(profile = {}, token = {}) {
  const provider = token?.firebase?.sign_in_provider;
  const current = provider === 'google.com' ? 'google' : provider === 'custom' ? 'emailOtp' : null;
  const known = [...new Set([...(Array.isArray(profile.authMethods) ? profile.authMethods : []), profile.provider, profile.lastAuthMethod, current])].filter(method => LABELS[method]);
  return {
    current: LABELS[current] || 'No disponible',
    methods: known.map(method => LABELS[method]).join(' · ') || 'No disponible'
  };
}
