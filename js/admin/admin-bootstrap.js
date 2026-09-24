// TINTIN — arranque protegido del panel.
// El runtime estable de Firebase se evalúa antes de que el loader clásico
// importe módulos administrativos que todavía conservan la URL histórica de
// firebase.js. Así una copia legacy nunca puede migrar la persistencia de una
// sesión activa durante la restauración.
import '../core/firebase/firebase-admin-estable.js?v=tintin-20260924-admin-auth-stable-1';

const loader = document.createElement('script');
loader.src = new URL('../cargador-pagina.js?v=tintin-20260923-auth-preview-isolation-1', import.meta.url).href;
loader.async = false;
loader.dataset.tintinAdminBootstrap = '1';
document.head.appendChild(loader);
