// Security bootstrap is required for reads. It does not authorize commercial
// writes, account creation, sign-in, email delivery or payments in an audit.
export function isReadOnlyAuditRequest(rawUrl, method) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  if (method !== 'POST') return false;
  const { hostname, pathname } = new URL(rawUrl);
  if (hostname === 'firestore.googleapis.com') {
    return /\/Listen\/channel$|:batchGet$|:runQuery$/.test(pathname);
  }
  if (hostname === 'firebaseappcheck.googleapis.com') {
    return /^\/v1\/projects\/[^/]+\/apps\/[^/]+:exchangeRecaptcha(?:Enterprise|V3)Token$/.test(pathname);
  }
  if (['www.google.com', 'www.recaptcha.net'].includes(hostname)) {
    return /^\/recaptcha\/(?:enterprise|api2)\/(?:reload|clr|userverify)$/.test(pathname);
  }
  return hostname === 'securetoken.googleapis.com' && pathname === '/v1/token';
}
