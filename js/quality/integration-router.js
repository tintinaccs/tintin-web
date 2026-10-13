(() => {
  'use strict';

  if (window.TintinIntegrationRouterBooted) return;
  window.TintinIntegrationRouterBooted = true;

  const originalFetch = window.fetch.bind(window);
  const APPS_SCRIPT_HOST = 'script.google.com';
  const APPS_SCRIPT_PATH = /^\/macros\/s\/[^/]+\/exec$/;
  const LEGACY_EDGE_DOMAINS = new Set(['github.io', 'netlify.app']);

  function isDomainOrSubdomain(hostname, domain) {
    const hostLabels = String(hostname || '').toLowerCase().split('.').filter(Boolean);
    const domainLabels = String(domain || '').toLowerCase().split('.').filter(Boolean);
    if (!domainLabels.length || hostLabels.length < domainLabels.length) return false;
    const offset = hostLabels.length - domainLabels.length;
    return domainLabels.every((label, index) => hostLabels[offset + index] === label);
  }

  function isLegacyEdgeHost(hostname) {
    for (const domain of LEGACY_EDGE_DOMAINS) {
      if (isDomainOrSubdomain(hostname, domain)) return true;
    }
    return false;
  }

  function functionOrigin() {
    const configured = String(window.TINTIN_FUNCTION_ORIGIN || '').trim().replace(/\/$/, '');
    if (configured) return configured;
    const hostname = String(window.location.hostname || '').toLowerCase();
    if (isLegacyEdgeHost(hostname)) {
      return 'https://tintinaccesorios.pages.dev';
    }
    return '';
  }

  function routedUrl(input) {
    if (typeof input !== 'string' && !(input instanceof URL)) return '';
    try {
      const url = new URL(String(input), window.location.href);
      if (url.protocol !== 'https:' || url.hostname !== APPS_SCRIPT_HOST || !APPS_SCRIPT_PATH.test(url.pathname)) {
        return '';
      }
      return `${functionOrigin()}/api/apps-script-bridge`;
    } catch {
      return '';
    }
  }

  window.fetch = function tintinIntegrationFetch(input, init) {
    const routed = routedUrl(input);
    return originalFetch(routed || input, init);
  };

  window.TintinIntegrationRouter = Object.freeze({
    appsScriptMode: 'cloudflare-bridge',
    bridgePath: '/api/apps-script-bridge'
  });
})();
