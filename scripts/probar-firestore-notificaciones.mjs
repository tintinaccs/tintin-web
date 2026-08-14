import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-tintin-social-notifications';
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { rules, host: '127.0.0.1', port: 8080 },
});

const claims = {
  client1: { email: 'clienta1@example.com', email_verified: true },
  client2: { email: 'clienta2@example.com', email_verified: true },
  blocked: { email: 'bloqueada@example.com', email_verified: true },
  super1: { email: 'tintinaccs@gmail.com', email_verified: true },
};

function dbFor(uid) {
  return testEnv.authenticatedContext(uid, claims[uid]).firestore();
}

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'settings', 'storeGate'), { storeOpen: true, maintenanceAccess: {} });
    await setDoc(doc(db, 'users', 'client1'), { email: claims.client1.email, role: 'client', blocked: false });
    await setDoc(doc(db, 'users', 'client2'), { email: claims.client2.email, role: 'client', blocked: false });
    await setDoc(doc(db, 'users', 'blocked'), { email: claims.blocked.email, role: 'client', blocked: true });
    await setDoc(doc(db, 'users', 'super1'), { email: claims.super1.email, role: 'superadmin', blocked: false });

    const common = {
      schemaVersion: 1,
      kind: 'review_like',
      title: 'Actividad de prueba',
      body: 'Contenido de prueba',
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await setDoc(doc(db, 'users', 'client1', 'notifications', 'notif_client1'), {
      ...common,
      audience: 'user',
      recipientUid: 'client1',
    });
    await setDoc(doc(db, 'users', 'client2', 'notifications', 'notif_client2'), {
      ...common,
      audience: 'user',
      recipientUid: 'client2',
    });
    await setDoc(doc(db, 'users', 'blocked', 'notifications', 'notif_blocked'), {
      ...common,
      audience: 'user',
      recipientUid: 'blocked',
    });
    await setDoc(doc(db, 'adminNotifications', 'notif_admin'), {
      ...common,
      audience: 'admin',
      recipientUid: '',
    });
  });
}

let checks = 0;
async function succeeds(promise) {
  checks += 1;
  return assertSucceeds(promise);
}
async function fails(promise) {
  checks += 1;
  return assertFails(promise);
}

try {
  await seed();

  const anon = testEnv.unauthenticatedContext().firestore();
  await fails(getDoc(doc(anon, 'users', 'client1', 'notifications', 'notif_client1')));
  await fails(getDoc(doc(anon, 'adminNotifications', 'notif_admin')));

  const client1 = dbFor('client1');
  await succeeds(getDoc(doc(client1, 'users', 'client1', 'notifications', 'notif_client1')));
  await succeeds(getDocs(query(collection(client1, 'users', 'client1', 'notifications'), limit(20))));
  await fails(getDocs(collection(client1, 'users', 'client1', 'notifications')));
  await fails(getDoc(doc(client1, 'users', 'client2', 'notifications', 'notif_client2')));
  await fails(getDocs(query(collection(client1, 'users', 'client2', 'notifications'), limit(20))));
  await fails(getDoc(doc(client1, 'adminNotifications', 'notif_admin')));

  await fails(setDoc(doc(client1, 'users', 'client1', 'notifications', 'forged'), {
    title: 'Notificación inventada', read: false,
  }));
  await fails(updateDoc(doc(client1, 'users', 'client1', 'notifications', 'notif_client1'), { read: true }));
  await fails(deleteDoc(doc(client1, 'users', 'client1', 'notifications', 'notif_client1')));

  const client2 = dbFor('client2');
  await fails(getDoc(doc(client2, 'users', 'client1', 'notifications', 'notif_client1')));

  const blocked = dbFor('blocked');
  await fails(getDoc(doc(blocked, 'users', 'blocked', 'notifications', 'notif_blocked')));

  const superDb = dbFor('super1');
  await succeeds(getDoc(doc(superDb, 'adminNotifications', 'notif_admin')));
  await succeeds(getDocs(query(collection(superDb, 'adminNotifications'), limit(20))));
  await fails(getDocs(collection(superDb, 'adminNotifications')));
  await fails(setDoc(doc(superDb, 'adminNotifications', 'forged_admin'), { title: 'Inventada' }));
  await fails(updateDoc(doc(superDb, 'adminNotifications', 'notif_admin'), { read: true }));
  await fails(deleteDoc(doc(superDb, 'adminNotifications', 'notif_admin')));

  // Ni siquiera Super Admin lee la bandeja privada de una clienta desde el navegador.
  // La administración recibe su propia copia saneada en adminNotifications.
  await fails(getDoc(doc(superDb, 'users', 'client1', 'notifications', 'notif_client1')));

  console.log(`Notificaciones Firestore: ${checks} controles de aislamiento y escritura verificados.`);
} finally {
  await testEnv.cleanup();
}
