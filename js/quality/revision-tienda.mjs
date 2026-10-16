// El primer snapshot establece la referencia de esta pestaña. Una aparición
// posterior a un documento inicialmente ausente también es una actualización.
export function createSiteRevisionObserver(onChange) {
  let initialized = false, revision = '';
  return data => {
    const next = typeof data?.revision === 'string' ? data.revision : '';
    if (!initialized) { initialized = true; revision = next; return; }
    if (!next || next === revision) return;
    revision = next;
    onChange();
  };
}
