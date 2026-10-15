/* El SDK sólo mejora la ficha pública ya visible; no bloquea su evaluación. */
let pending;
export function loadProductRealtimeDependencies() {
  if (!pending) pending = Promise.all([
    import('../firebase/firebase.js?v=tintin-20261012-auth-privacy-1-firebase-js-domain-prepared-20261012-6-pedidos-styles-20261013-1-security-ready-20261013-2'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
  ]).then(([firebase, firestore]) => ({ ...firebase, ...firestore }));
  return pending;
}
