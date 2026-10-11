// A report-only policy records a violation without blocking the document.
// Keep the exact observed Google diagnostic; never exempt effective CSP or JS exceptions.
const googleFrameReportOnly = `Framing 'https://www.google.com/' violates the following report-only Content Security Policy directive: "frame-ancestors 'self'". The violation has been logged, but no further action has been taken.`;

export function classifyAuthBrowserDiagnostic({ source, text }) {
  if (source === 'pageerror') return 'blocking';
  const message = String(text || '').trim();
  if (message === googleFrameReportOnly) return 'google-frame-report-only';
  if (!/content security policy|frame-ancestors/i.test(message)
      && /app.?check|recaptcha/i.test(message)
      && /appCheck\/throttled|requests throttled/i.test(message)) return 'recaptcha-throttled';
  return 'blocking';
}
