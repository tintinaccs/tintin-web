// Sólo transporte del editor: nunca convierte una página HTML en confirmación.
export async function readProductEditorResponse(response) {
  const failure = () => Object.assign(new Error(response.status === 401
    ? 'Tu sesión necesita renovarse. Reintentá sin cerrar el editor.'
    : response.status === 403 ? 'No tenés permisos para guardar esta edición.'
    : response.status === 429 ? 'Demasiadas solicitudes. Esperá un momento y reintentá.'
    : 'El servidor no confirmó el guardado. Conservá el editor abierto y reintentá.'), {status:response.status});
  let payload;
  try { payload = await response.json(); } catch { throw failure(); }
  if (!payload || typeof payload !== 'object' || typeof payload.ok !== 'boolean') throw failure();
  if (!response.ok || !payload.ok) {
    const error = failure();
    if (typeof payload.error === 'string' && !/[<>]/.test(payload.error)) error.message = payload.error;
    throw error;
  }
  if (!payload.result || typeof payload.result !== 'object') throw failure();
  return payload;
}
