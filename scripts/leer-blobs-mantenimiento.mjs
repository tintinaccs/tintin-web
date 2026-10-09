export async function readTrustedOrRemote(entry, original, readTrusted, readRemote) {
  if (!entry || !['100644', '100755'].includes(entry.mode) || !/^[a-f0-9]{40}$/.test(entry.sha)) {
    throw new Error('Blob candidato ausente o no regular.');
  }
  // Un mismo objeto Git y modo contiene exactamente los mismos bytes.
  // El checkout confiable de main ya tiene esos bytes; no requiere otra API.
  return entry.sha === original?.sha && entry.mode === original.mode
    ? readTrusted() : readRemote();
}
