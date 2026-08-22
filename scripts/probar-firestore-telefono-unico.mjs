// Un teléfono, una cuenta — verificado contra el emulador de Firestore.
//
// La unicidad y la inmutabilidad no pueden depender del código del navegador:
// estos casos comprueban que las reglas las sostienen incluso si alguien
// intenta escribir directo desde la consola.
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const projectId = 'demo-tintin-phone';
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

const TEL_ANA = '595981123456';
const TEL_OTRO = '595971000000';
let checks = 0;
const ok = async (label, p) => { await assertSucceeds(p); checks++; console.log(`OK   ${label}`); };
const no = async (label, p) => { await assertFails(p); checks++; console.log(`OK   ${label} (rechazado, como corresponde)`); };

try {
  await testEnv.withSecurityRulesDisabled(async ctxAdmin => {
    const db = ctxAdmin.firestore();
    await setDoc(doc(db, 'settings', 'storeGate'), { storeOpen: true });
    for (const uid of ['ana', 'bea']) {
      await setDoc(doc(db, 'users', uid), {
        name: '', email: claims[uid].email, phone: '', role: 'client', blocked: false,
        profileStatus: 'incomplete', customerId: `CUS_${uid}`,
      });
    }
  });

  const ana = ctx('ana');
  const bea = ctx('bea');

  await ok('Ana reserva su número inicial',
    setDoc(doc(ana, 'phoneReservations', TEL_ANA), { uid: 'ana', createdAt: serverTimestamp() }));

  await no('Bea NO puede reservar el mismo número',
    setDoc(doc(bea, 'phoneReservations', TEL_ANA), { uid: 'bea', createdAt: serverTimestamp() }));

  await no('Nadie puede reservar un número a nombre de otra cuenta',
    setDoc(doc(bea, 'phoneReservations', '595981999999'), { uid: 'ana', createdAt: serverTimestamp() }));

  await no('Una reserva no se puede leer para averiguar si un número tiene cuenta',
    getDoc(doc(bea, 'phoneReservations', TEL_ANA)));

  // El teléfono se fija una vez durante el onboarding incomplete -> active.
  await ok('Ana fija el número reservado al completar onboarding',
    updateDoc(doc(ana, 'users', 'ana'), {
      phone: '+' + TEL_ANA,
      profileStatus: 'active',
      updatedAt: serverTimestamp(),
    }));

  await no('Ana NO puede cambiar su teléfono después del onboarding',
    updateDoc(doc(ana, 'users', 'ana'), { phone: '+' + TEL_OTRO, updatedAt: serverTimestamp() }));

  await no('Ana NO puede vaciar su teléfono después del onboarding',
    updateDoc(doc(ana, 'users', 'ana'), { phone: '', updatedAt: serverTimestamp() }));

  await no('Ana NO puede reservar un segundo teléfono desde el navegador',
    setDoc(doc(ana, 'phoneReservations', TEL_OTRO), { uid: 'ana', createdAt: serverTimestamp() }));

  await no('Bea NO puede escribir en su perfil el número de Ana desde la consola',
    updateDoc(doc(bea, 'users', 'bea'), { phone: '+' + TEL_ANA, updatedAt: serverTimestamp() }));

  await no('Bea NO puede escribir un número que nadie reservó',
    updateDoc(doc(bea, 'users', 'bea'), { phone: '+' + TEL_OTRO, updatedAt: serverTimestamp() }));

  await ok('Ana actualiza otros campos sin tocar el teléfono',
    updateDoc(doc(ana, 'users', 'ana'), { name: 'Ana Gómez', updatedAt: serverTimestamp() }));

  await no('Otra cuenta no puede borrar la reserva de Ana',
    deleteDoc(doc(bea, 'phoneReservations', TEL_ANA)));

  await no('Ana tampoco puede liberar su teléfono activo desde el navegador',
    deleteDoc(doc(ana, 'phoneReservations', TEL_ANA)));

  await no('Mientras la reserva canónica exista, Bea no puede tomar ese número',
    setDoc(doc(bea, 'phoneReservations', TEL_ANA), { uid: 'bea', createdAt: serverTimestamp() }));

  console.log(`\nUn teléfono una cuenta + teléfono inmutable: ${checks} controles verificados contra el emulador.`);
} finally {
  await testEnv.cleanup();
}
