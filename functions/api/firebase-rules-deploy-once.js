import { getGoogleAccessToken } from '../../cloudflare/firebase-admin-ligero.js';

const PROJECT_ID = 'tintin-accesorios';
const REVIEWED_COMMIT = 'c64acac6bed8ec41ef610dbc7473be676a1c1aca';
const RULES_URL = `https://raw.githubusercontent.com/tintinaccs/tintin-web/${REVIEWED_COMMIT}/firestore.rules`;
const API = 'https://firebaserules.googleapis.com/v1';

function json(status, payload) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function apiError(label, response) {
  const data = await readJson(response);
  const message = data?.error?.message || data?.message || `HTTP ${response.status}`;
  throw new Error(`${label}: ${message}`);
}

async function getCurrentRelease(accessToken) {
  const headers = { authorization: `Bearer ${accessToken}` };
  const canonicalName = `projects/${PROJECT_ID}/releases/cloud.firestore`;
  const direct = await fetch(`${API}/${canonicalName}`, { headers });
  if (direct.ok) return readJson(direct);
  if (direct.status !== 404) await apiError('No se pudo consultar la release actual', direct);

  const list = await fetch(`${API}/projects/${PROJECT_ID}/releases?pageSize=100`, { headers });
  if (!list.ok) await apiError('No se pudieron listar las releases', list);
  const data = await readJson(list);
  const releases = Array.isArray(data.releases) ? data.releases : [];
  return releases.find((release) => {
    const name = String(release?.name || '');
    return name === canonicalName || name === `${canonicalName}/(default)`;
  }) || null;
}

async function getRuleset(accessToken, rulesetName) {
  if (!rulesetName) return null;
  const response = await fetch(`${API}/${rulesetName}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) await apiError('No se pudo leer el ruleset actual', response);
  return readJson(response);
}

function sourceContent(ruleset) {
  const files = Array.isArray(ruleset?.source?.files) ? ruleset.source.files : [];
  const named = files.find((file) => file?.name === 'firestore.rules');
  return String(named?.content || files[0]?.content || '');
}

async function createRuleset(accessToken, rules) {
  const response = await fetch(`${API}/projects/${PROJECT_ID}/rulesets`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      source: {
        files: [{ name: 'firestore.rules', content: rules }],
      },
    }),
  });
  if (!response.ok) await apiError('Firebase rechazó el nuevo ruleset', response);
  const data = await readJson(response);
  if (!data?.name) throw new Error('Firebase creó el ruleset sin devolver su nombre');
  return data;
}

async function releaseRuleset(accessToken, currentRelease, rulesetName) {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  };
  if (currentRelease?.name) {
    const response = await fetch(`${API}/${currentRelease.name}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        release: {
          name: currentRelease.name,
          rulesetName,
        },
        updateMask: 'rulesetName',
      }),
    });
    if (!response.ok) await apiError('No se pudo actualizar la release de Firestore', response);
    return readJson(response);
  }

  const releaseName = `projects/${PROJECT_ID}/releases/cloud.firestore`;
  const response = await fetch(`${API}/projects/${PROJECT_ID}/releases`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: releaseName,
      rulesetName,
    }),
  });
  if (!response.ok) await apiError('No se pudo crear la release de Firestore', response);
  return readJson(response);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  // Este endpoint es deliberadamente temporal y NO acepta reglas arbitrarias.
  // Solo puede publicar el archivo ya revisado del commit exacto indicado.
  if (url.searchParams.get('commit') !== REVIEWED_COMMIT) {
    return json(404, { ok: false, error: 'Not found' });
  }

  try {
    const accessToken = await getGoogleAccessToken(env, [
      'https://www.googleapis.com/auth/cloud-platform',
    ]);

    const sourceResponse = await fetch(RULES_URL, {
      headers: { 'user-agent': 'Tintin-Firebase-Rules-Deployer/1.0' },
    });
    if (!sourceResponse.ok) {
      throw new Error(`No se pudo cargar firestore.rules del commit revisado (${sourceResponse.status})`);
    }
    const rules = await sourceResponse.text();
    if (!rules.includes('service cloud.firestore') || rules.length < 100) {
      throw new Error('El archivo revisado no parece contener reglas válidas de Cloud Firestore');
    }

    const currentRelease = await getCurrentRelease(accessToken);
    const previousRulesetName = String(currentRelease?.rulesetName || '');
    const currentRuleset = await getRuleset(accessToken, previousRulesetName);

    if (currentRuleset && sourceContent(currentRuleset) === rules) {
      return json(200, {
        ok: true,
        deployed: false,
        alreadyCurrent: true,
        projectId: PROJECT_ID,
        reviewedCommit: REVIEWED_COMMIT,
        releaseName: currentRelease.name,
        rulesetName: previousRulesetName,
      });
    }

    const createdRuleset = await createRuleset(accessToken, rules);
    const released = await releaseRuleset(accessToken, currentRelease, createdRuleset.name);
    const verifiedRelease = await getCurrentRelease(accessToken);

    if (!verifiedRelease || verifiedRelease.rulesetName !== createdRuleset.name) {
      throw new Error('Firebase no confirmó que la release apunte al ruleset recién creado');
    }

    return json(200, {
      ok: true,
      deployed: true,
      alreadyCurrent: false,
      projectId: PROJECT_ID,
      reviewedCommit: REVIEWED_COMMIT,
      previousRulesetName: previousRulesetName || null,
      rulesetName: createdRuleset.name,
      releaseName: verifiedRelease.name || released?.name || null,
      verified: true,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      projectId: PROJECT_ID,
      reviewedCommit: REVIEWED_COMMIT,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
