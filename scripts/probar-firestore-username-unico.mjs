// Un username, una cuenta — verificado contra el emulador de Firestore.
//
// La asignación inicial ocurre durante onboarding. Después de eso, el SDK del
// navegador no puede modificar ni liberar el username: el único cambio
// permitido pasa por /api/account-username-change en backend.
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const projectId = 'demo-tintin-username';
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules, host: '127.0.0.1', port: 8080 }
});

const claims = {
  ana:  { email: 'ana@example.com', email_verified: true },
  bea:  { email: 'bea@example.com', email_verified: true },
};
const ctx = uid => testEnv.authenticatedContext(uid, claims[uid]).firestore();

const USERNAME_ANA = 'ana_98';
const USERNAME_NUEVO = 'ana_nueva';
let checks = 0;
const ok = async (label, p) => { await assertSucceeds(p); checks++; console.log(`OK   ${label}`); };
const no = async (label, p) => { await assertFails(p); checks++; console.log(`OK   ${label} (rechazado, como corresponde)`); };

try {
  await testEnv.withSecurityRulesDisabled(async ctxAdmin => {
    const db = ctxAdmin.firestore();
    await setDoc(doc(db, 'settings', 'storeGate'), { storeOpen: true });
    for (const uid of ['ana', 'bea']) {
      await setDoc(doc(db, 'users', uid), {
        name: '', email: claims[uid].email, phone: '', username: '', role: 'client', blocked: false,
        profileStatus: 'incomplete', customerId: `CUS_${uid}`,
      });
    }
  });

  const ana = ctx('ana');
  const bea = ctx('bea');

  await ok('Ana reserva su username inicial',
    setDoc(doc(ana, 'usernameReservations', USERNAME_ANA), { uid: 'ana', createdAt: serverTimestamp() }));

  await no('Bea NO puede reservar el mismo username',
    setDoc(doc(bea, 'usernameReservations', USERNAME_ANA), { uid: 'bea', createdAt: serverTimestamp() }));

  await no('Nadie puede reservar un username a nombre de otra cuenta',
    setDoc(doc(bea, 'usernameReservations', 'bea_libre'), { uid: 'ana', createdAt: serverTimestamp() }));

  await no('Una reserva no se puede leer para averiguar si un username tiene cuenta',
    getDoc(doc(bea, 'usernameReservations', USERNAME_ANA)));

  await no('Un username fuera de formato no se puede reservar',
    setDoc(doc(ana, 'usernameReservations', 'AB'), { uid: 'ana', createdAt: serverTimestamp() }));

  await ok('Ana fija el username reservado al completar onboarding',
    updateDoc(doc(ana, 'users', 'ana'), {
      username: USERNAME_ANA,
      profileStatus: 'active',
      updatedAt: serverTimestamp(),
    }));

  await no('Ana NO puede cambiar directamente el username después del onboarding',
    updateDoc(doc(ana, 'users', 'ana'), { username: USERNAME_NUEVO, updatedAt: serverTimestamp() }));

  await no('Ana NO puede vaciar directamente el username después del onboarding',
    updateDoc(doc(ana, 'users', 'ana'), { username: '', updatedAt: serverTimestamp() }));

  await no('Ana NO puede reservar usernames adicionales desde el navegador',
    setDoc(doc(ana, 'usernameReservations', USERNAME_NUEVO), { uid: 'ana', createdAt: serverTimestamp() }));

  await no('Bea NO puede escribir en su perfil el username de Ana desde la consola',
    updateDoc(doc(bea, 'users', 'bea'), { username: USERNAME_ANA, updatedAt: serverTimestamp() }));

  await no('Bea NO puede escribir un username que nadie reservó',
    updateDoc(doc(bea, 'users', 'bea'), { username: 'bea_libre', updatedAt: serverTimestamp() }));

  await ok('Ana actualiza otros campos sin tocar el username',
    updateDoc(doc(ana, 'users', 'ana'), { name: 'Ana Gómez', updatedAt: serverTimestamp() }));

  await no('Otra cuenta no puede borrar la reserva de Ana',
    deleteDoc(doc(bea, 'usernameReservations', USERNAME_ANA)));

  await no('Ana tampoco puede liberar su username activo desde el navegador',
    deleteDoc(doc(ana, 'usernameReservations', USERNAME_ANA)));

  await no('Mientras la reserva canónica exista, Bea no puede tomar ese username',
    setDoc(doc(bea, 'usernameReservations', USERNAME_ANA), { uid: 'bea', createdAt: serverTimestamp() }));

  console.log(`\nUn username una cuenta + cambios sólo por backend: ${checks} controles verificados contra el emulador.`);
} finally {
  await testEnv.cleanup();
}
