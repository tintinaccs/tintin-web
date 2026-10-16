// La operación de negocio conserva su resultado y error originales. Un fallo
// del aviso nunca debe invitar a repetir un pedido o una escritura ya hecha.
export function createConfirmedChangeWriter({ publish, enabled = () => true, onError = () => {} }) {
  return async function withAdminSiteChange(write) {
    const result = await write();
    if (enabled()) {
      try { Promise.resolve(publish()).catch(onError); }
      catch (error) { onError(error); }
    }
    return result;
  };
}
