/* El SDK sólo mejora la ficha pública ya visible; no bloquea su evaluación. */
let pending;
export function loadProductRealtimeDependencies() {
  if (!pending) pending = Promise.all([
    import('../firebase/firebase.js?v=tintin-20261017-domain-cutover-1'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'),
  ]).then(([firebase, firestore]) => ({ ...firebase, ...firestore }));
  return pending;
}
