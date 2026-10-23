import { execFileSync } from 'node:child_process';

const allowed = ['quick', 'checkout', 'header', 'catalogo', 'inicio'];
const requested = process.env.REQUESTED_AREA;
if (requested && !allowed.includes(requested)) throw new Error('Área inválida');
let selected = requested;
if (!selected) {
  const before = process.env.BEFORE_SHA;
  // A first push has no prior tree. Use the full commit's changed-file list;
  // do not interpolate event data in shell or JavaScript source.
  const args = /^[a-f0-9]{40}$/.test(before || '') && !/^0+$/.test(before)
    ? ['diff', '--name-only', before, 'HEAD'] : ['show', '--pretty=format:', '--name-only', 'HEAD'];
  let files;
  try { files = execFileSync('git', args, {encoding:'utf8'}); }
  catch { throw new Error('No se pudo determinar el cambio; ejecutar dev:check con un área explícita.'); }
  // Shared changes need a full release validation as usual. Editing checks are
  // feedback only; select the relevant UI when one is recognized.
  selected = /checkout|orders\/|payments\//.test(files) ? 'checkout'
    : /navigation|encabezado|header/.test(files) ? 'header'
    : /catalog|tienda\.|products|cart\//.test(files) ? 'catalogo'
    : /index\.html|styles\.(?:min\.)?css|pages\/home|estilos-inicio/.test(files) ? 'inicio' : 'quick';
}
console.log(`EDIT_AREA=${selected}`);
