/** El panel utiliza el mismo esquema publicado que toda la plataforma.
 * Conserva el gate administrativo antes de iniciar lecturas; los documentos
 * de esquemas anteriores permanecen en Firestore como historial, sin activarse.
 */
import { waitForAdminAppCheck } from '../auth/app-check-admin.js?v=tintin-20261017-domain-cutover-1';

if (await waitForAdminAppCheck(12000)) {
  await import('../../components/color/esquema-color.js?v=tintin-20261017-domain-cutover-1');
}

if (document.getElementById('visual-editor')) {
  import('../appearance/visual-studio-global-admin.js?v=tintin-20261022-avatar-inicial-1');
}
