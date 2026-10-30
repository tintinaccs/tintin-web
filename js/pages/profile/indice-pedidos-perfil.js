import { appCheck } from '../../core/firebase/firebase.js?v=tintin-20261017-domain-cutover-1';
import { getToken } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js';
import { runAuthenticatedQueryRest } from '../../core/firebase/respaldo-rest-firestore.js?v=tintin-20261030-home-history-1';

export const ORDER_INDEX_FIELDS = ['createdAt','updatedAt','total','status','payment.status','paymentStatus','orderNumber','shortId','orderCode'];
export const ORDER_INDEX_PAGE_SIZE = 100;

export function accountOrdersIndexQuery(user, cursor = '') {
  if (!user?.uid) throw new Error('Se requiere una sesión para leer el historial.');
  const filters = [{fieldFilter:{field:{fieldPath:'userId'},op:'EQUAL',value:{stringValue:user.uid}}}];
  if (user.emailVerified === true && user.email) {
    for (const email of new Set([user.email, user.email.trim().toLowerCase()])) {
      filters.push({fieldFilter:{field:{fieldPath:'userEmail'},op:'EQUAL',value:{stringValue:email}}});
    }
  }
  const query = {
    from:[{collectionId:'orders'}],
    where:filters.length === 1 ? filters[0] : {compositeFilter:{op:'OR',filters}},
    select:{fields:ORDER_INDEX_FIELDS.map(fieldPath=>({fieldPath}))},
    orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],
    limit:ORDER_INDEX_PAGE_SIZE,
  };
  if (cursor) {
    if (!/^projects\/[^/]+\/databases\/[^/]+\/documents\/orders\/[^/]+$/.test(cursor)) throw new Error('Cursor de historial inválido.');
    query.startAt={values:[{referenceValue:cursor}],before:false};
  }
  return query;
}

export async function readAccountOrdersIndexPage({user, cursor = '', readTime = '', signal}) {
  const structuredQuery = accountOrdersIndexQuery(user, cursor);
  const idToken = await user.getIdToken();
  const token = await getToken(appCheck, false);
  const page = await runAuthenticatedQueryRest(structuredQuery, {idToken,appCheckToken:token.token,readTime,signal});
  if (page.documents.length > ORDER_INDEX_PAGE_SIZE) throw new Error('Página de historial fuera de límite.');
  if (page.documents.length && !page.readTime) throw new Error('El historial no confirmó su revisión.');
  return {
    items:page.documents.map(row=>({...row.data,id:row.id})),
    cursor:page.documents.length === ORDER_INDEX_PAGE_SIZE ? page.documents.at(-1).name : '',
    readTime:page.readTime || readTime,
  };
}
