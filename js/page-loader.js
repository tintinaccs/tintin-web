/* Page loader — gear spinner overlay for all non-home pages.
   Loaded as a blocking (non-deferred) script so it renders before content.
   Self-contained: injects its own CSS so it works on pages without styles.css */
(function () {
  var CSS = [
    '#tt-loader{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#fce4ec;transition:opacity .42s ease,visibility .42s ease}',
    '#tt-loader.tt-out{opacity:0;visibility:hidden;pointer-events:none}',
    '.tt-loader-inner{display:flex;flex-direction:column;align-items:center;gap:18px}',
    '.tt-gear-svg{width:52px;height:52px;color:#b84c72;animation:tt-gear-spin 1.1s linear infinite}',
    '@keyframes tt-gear-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
    '.tt-loader-dots{display:flex;gap:7px}',
    '.tt-loader-dots span{width:7px;height:7px;border-radius:50%;background:#b84c72;opacity:.25;animation:tt-dot-pulse 1.1s ease-in-out infinite}',
    '.tt-loader-dots span:nth-child(2){animation-delay:.18s}',
    '.tt-loader-dots span:nth-child(3){animation-delay:.36s}',
    '@keyframes tt-dot-pulse{0%,80%,100%{opacity:.25;transform:scale(.85)}40%{opacity:1;transform:scale(1.2)}}',
    '@media(prefers-reduced-motion:reduce){.tt-gear-svg{animation:none}.tt-loader-dots span{animation:none;opacity:.6}}'
  ].join('');

  var GEAR_SVG = '<svg class="tt-gear-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a6.97 6.97 0 0 0-1.62-.94l-.36-2.54A.484.484 0 0 0 15.93 2h-3.84a.48.48 0 0 0-.47.41l-.36 2.54a6.97 6.97 0 0 0-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L4.74 8.47a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54a6.97 6.97 0 0 0 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>';

  // Inject styles (only once per page)
  if (!document.getElementById('tt-loader-style')) {
    var st = document.createElement('style');
    st.id = 'tt-loader-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // Build loader div
  var div = document.createElement('div');
  div.id = 'tt-loader';
  div.setAttribute('aria-hidden', 'true');
  div.setAttribute('role', 'presentation');
  div.innerHTML = '<div class="tt-loader-inner">' + GEAR_SVG +
    '<div class="tt-loader-dots"><span></span><span></span><span></span></div></div>';

  function insert() {
    if (!document.getElementById('tt-loader') && document.body) {
      document.body.insertBefore(div, document.body.firstChild);
    }
  }

  if (document.body) {
    insert();
  } else {
    document.addEventListener('DOMContentLoaded', insert);
  }

  var hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    var el = document.getElementById('tt-loader');
    if (!el) return;
    el.classList.add('tt-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
  }

  window.addEventListener('load', hide);
  setTimeout(hide, 5000); // safety cap — never blocks the user
})();
