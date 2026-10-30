import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, getDoc, getDocs, query, orderBy, limit, where, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Requiere emulador loopback explícito.');
const [address, port] = host.split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-tintin-critical', firestore: { host: address, port: Number(port), rules: fs.readFileSync('firestore.rules', 'utf8') } });
let checks = 0;
try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'settings/storeGate'), { storeOpen: true });
    for (const role of ['admin', 'agent', 'client', 'viewer']) await setDoc(doc(db, `users/qa-audit-${role}`), { role, blocked: false });
    await setDoc(doc(db, 'auditLog/qa-audit-seeded'), { action: 'editar_producto', targetId: 'qa-product', actorEmail: 'server@example.invalid', createdAt: serverTimestamp() });
  });
  const owner = env.authenticatedContext('qa-owner', { email: 'tintinaccs@gmail.com', email_verified: true }).firestore();
  const clients = [env.unauthenticatedContext().firestore(), ...['admin', 'agent', 'client', 'viewer'].map(role => env.authenticatedContext(`qa-audit-${role}`, { email: `${role}@example.invalid`, email_verified: true }).firestore()), owner];
  for (const db of clients) {
    for (const patch of [{}, { actorEmail: 'tintinaccs@gmail.com', actorRole: 'superadmin' }, { createdAt: new Date('2099-01-01') }, { bulk: true, bulkCount: '<span>HTML</span>' }]) {
      await assertFails(setDoc(doc(db, 'auditLog/qa-audit-forged'), { action: 'editar_producto', createdAt: serverTimestamp(), ...patch })); checks++;
    }
    await assertFails(updateDoc(doc(db, 'auditLog/qa-audit-seeded'), { actorId: 'forged', extra: 'x'.repeat(10000) })); checks++;
    await assertFails(deleteDoc(doc(db, 'auditLog/qa-audit-seeded'))); checks++;
    if (db !== owner) {
      await assertFails(getDoc(doc(db, 'auditLog/qa-audit-seeded'))); checks++;
      await assertFails(getDocs(query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(200)))); checks++;
    }
  }
  await assertSucceeds(getDoc(doc(owner, 'auditLog/qa-audit-seeded'))); checks++;
  await assertSucceeds(getDocs(query(collection(owner, 'auditLog'), orderBy('createdAt', 'desc'), limit(200)))); checks++;
  await assertSucceeds(getDocs(query(collection(owner, 'auditLog'), where('targetId', '==', 'qa-product'), limit(50)))); checks++;
  console.log(`${checks} verificaciones de Auditoría: suplantación, HTML, inmutabilidad, lecturas y consultas aprobadas.`);
} finally { await env.cleanup(); }
