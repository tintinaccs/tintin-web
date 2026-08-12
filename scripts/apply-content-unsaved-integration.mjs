import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`No se encontró el bloque requerido: ${label}`);
  }
  return source.replace(before, after);
}

let content = read('js/admin/content/gestion-contenido-admin.js');

if (!content.includes('let activeUnsavedScopeId = null;')) {
  content = replaceRequired(
    content,
    `  let permissions = { view: false, edit: false, toggle: false, restore: false };\n  let ui = null;`,
    `  let permissions = { view: false, edit: false, toggle: false, restore: false };\n  let ui = null;\n  let activeUnsavedScopeId = null;`,
    'estado del guard compartido'
  );
}

if (!content.includes('function contentUnsavedId()')) {
  const anchor = `  function confirmDiscard() {\n    if (!dirty) return true;\n    return window.confirm('Hay cambios sin guardar. ¿Querés descartarlos y continuar?');\n  }`;
  const helpers = `${anchor}\n\n  function contentUnsavedId() {\n    return \`content:\${currentPageId}:\${currentSectionId}\`;\n  }\n\n  function unregisterUnsavedScope() {\n    if (!activeUnsavedScopeId) return;\n    window.AdminUnsaved?.unregister(activeUnsavedScopeId);\n    activeUnsavedScopeId = null;\n  }\n\n  function markContentDirty() {\n    dirty = true;\n    if (activeUnsavedScopeId) window.AdminUnsaved?.markDirty(activeUnsavedScopeId);\n  }\n\n  function registerUnsavedScope() {\n    if (!window.AdminUnsaved || !ui?.fields || !currentSectionId) return;\n    const nextId = contentUnsavedId();\n    if (activeUnsavedScopeId && activeUnsavedScopeId !== nextId) {\n      window.AdminUnsaved.unregister(activeUnsavedScopeId);\n    }\n    activeUnsavedScopeId = nextId;\n    const pageLabel = getPageSchema(currentPageId)?.label || currentPageId;\n    const sectionLabel = getSectionSchema(currentPageId, currentSectionId)?.label || currentSectionId;\n    window.AdminUnsaved.register(nextId, {\n      root: ui.fields,\n      label: \`Contenido: \${pageLabel} / \${sectionLabel}\`,\n      active: () => document.getElementById('section-apariencia')?.classList.contains('active') && ui?.section?.isConnected,\n      serialize: () => JSON.stringify(collectFormValues()),\n      save: () => handleSave(),\n    });\n    window.AdminUnsaved.markClean(nextId);\n  }`;
  content = replaceRequired(content, anchor, helpers, 'helpers de AdminUnsaved');
}

if (content.includes(`      dirty = true;\n      remotePending = false;\n      setNotice('Tenés cambios sin guardar.', 'warning');`)) {
  content = content.replace(
    `      dirty = true;\n      remotePending = false;\n      setNotice('Tenés cambios sin guardar.', 'warning');`,
    `      markContentDirty();\n      remotePending = false;\n      setNotice('Tenés cambios sin guardar.', 'warning');`
  );
}

if (content.includes(`      checkbox.addEventListener('change', () => {\n        dirty = true;\n        setNotice('Tenés cambios sin guardar.', 'warning');\n      });`)) {
  content = content.replace(
    `      checkbox.addEventListener('change', () => {\n        dirty = true;\n        setNotice('Tenés cambios sin guardar.', 'warning');\n      });`,
    `      checkbox.addEventListener('change', () => {\n        markContentDirty();\n        setNotice('Tenés cambios sin guardar.', 'warning');\n      });`
  );
}

if (!content.includes(`    registerUnsavedScope();\n    setNotice('Los cambios se sincronizan en tiempo real después de guardar.', 'info');`)) {
  content = replaceRequired(
    content,
    `    dirty = false;\n    remotePending = false;\n    setNotice('Los cambios se sincronizan en tiempo real después de guardar.', 'info');`,
    `    dirty = false;\n    remotePending = false;\n    registerUnsavedScope();\n    setNotice('Los cambios se sincronizan en tiempo real después de guardar.', 'info');`,
    'registro del scope al renderizar'
  );
}

content = content.replace(
  `  async function saveSection(values, successMessage) {\n    if (!permissions.edit || !currentUser) return;`,
  `  async function saveSection(values, successMessage) {\n    if (!permissions.edit || !currentUser) return false;`
);

if (!content.includes('window.AdminUnsaved?.markClean(activeUnsavedScopeId)')) {
  content = replaceRequired(
    content,
    `      dirty = false;\n      remotePending = false;\n      setNotice('Guardado y sincronizado.', 'success');\n      toast(successMessage);`,
    `      dirty = false;\n      remotePending = false;\n      if (activeUnsavedScopeId) window.AdminUnsaved?.markClean(activeUnsavedScopeId);\n      setNotice('Guardado y sincronizado.', 'success');\n      toast(successMessage);\n      return true;`,
    'resultado exitoso de guardado'
  );
}

if (!content.includes(`toast('No se pudo guardar el contenido.', true);\n      return false;`)) {
  content = replaceRequired(
    content,
    `      toast('No se pudo guardar el contenido.', true);\n    } finally {`,
    `      toast('No se pudo guardar el contenido.', true);\n      return false;\n    } finally {`,
    'resultado fallido de guardado'
  );
}

if (content.includes(`      toast('Corregí el enlace marcado antes de guardar.', true);\n      return;\n    }\n    await saveSection(collectFormValues(), '✅ Contenido guardado');`)) {
  content = content.replace(
    `      toast('Corregí el enlace marcado antes de guardar.', true);\n      return;\n    }\n    await saveSection(collectFormValues(), '✅ Contenido guardado');`,
    `      toast('Corregí el enlace marcado antes de guardar.', true);\n      return false;\n    }\n    return saveSection(collectFormValues(), '✅ Contenido guardado');`
  );
}

if (!content.includes(`if (pageId === currentPageId || !confirmDiscard()) return;\n    unregisterUnsavedScope();`)) {
  content = replaceRequired(
    content,
    `    if (pageId === currentPageId || !confirmDiscard()) return;\n    currentPageId = pageId;`,
    `    if (pageId === currentPageId || !confirmDiscard()) return;\n    unregisterUnsavedScope();\n    currentPageId = pageId;`,
    'limpieza al cambiar página'
  );
}

if (!content.includes(`    unregisterUnsavedScope();\n    currentSectionId = sectionId;`)) {
  content = replaceRequired(
    content,
    `    }\n    currentSectionId = sectionId;\n    dirty = false;\n    renderForm();`,
    `    }\n    unregisterUnsavedScope();\n    currentSectionId = sectionId;\n    dirty = false;\n    renderForm();`,
    'limpieza al cambiar sección'
  );
}

content = content.replace(
  /\n\s*window\.addEventListener\('beforeunload', event => \{\n\s*if \(!dirty\) return;\n\s*event\.preventDefault\(\);\n\s*event\.returnValue = '';\n\s*\}\);/,
  ''
);

if (!content.includes(`pageUnsubscribe = null;\n      unregisterUnsavedScope();`)) {
  content = replaceRequired(
    content,
    `      pageUnsubscribe?.();\n      pageUnsubscribe = null;`,
    `      pageUnsubscribe?.();\n      pageUnsubscribe = null;\n      unregisterUnsavedScope();`,
    'limpieza al cambiar sesión'
  );
}

if (!content.includes('`content:${currentPageId}:${currentSectionId}`')) throw new Error('Falta ID dinámico de contenido.');
if (!content.includes('window.AdminUnsaved.register(nextId')) throw new Error('Falta registro global de contenido.');
if (!content.includes('window.AdminUnsaved?.markDirty(activeUnsavedScopeId)')) throw new Error('Falta markDirty global.');
if (!content.includes('window.AdminUnsaved?.markClean(activeUnsavedScopeId)')) throw new Error('Falta markClean global.');
if (content.includes("window.addEventListener('beforeunload'")) throw new Error('Quedó beforeunload local redundante.');
write('js/admin/content/gestion-contenido-admin.js', content);

let phase6 = read('scripts/auditar-contenido-fase-6.js');
if (!phase6.includes('Los cambios sin guardar usan el guard global sin listener duplicado')) {
  phase6 = replaceRequired(
    phase6,
    `check(\n  'Los cambios sin guardar están protegidos',\n  files.admin.includes("window.addEventListener('beforeunload'") &&\n    files.admin.includes('confirmDiscard()') &&\n    files.admin.includes('Hay cambios sin guardar'),\n  'Cambiar de página o cerrar no debe perder texto en silencio'\n);`,
    `check(\n  'Los cambios sin guardar usan el guard global sin listener duplicado',\n  files.admin.includes('window.AdminUnsaved.register(nextId') &&\n    files.admin.includes('window.AdminUnsaved?.markDirty(activeUnsavedScopeId)') &&\n    files.admin.includes('window.AdminUnsaved?.markClean(activeUnsavedScopeId)') &&\n    files.admin.includes('confirmDiscard()') &&\n    files.admin.includes('Hay cambios sin guardar') &&\n    !files.admin.includes("window.addEventListener('beforeunload'"),\n  'Contenido debe integrarse al guard compartido; no crear otro beforeunload'\n);`,
    'auditoría Fase 6 del guard'
  );
}
write('scripts/auditar-contenido-fase-6.js', phase6);

let integral = read('scripts/auditar-integral-plataforma.js');
if (!integral.includes("contentAdmin: read('js/admin/content/gestion-contenido-admin.js')")) {
  integral = replaceRequired(
    integral,
    `  adminGuard: read('js/admin/proteccion-cambios-pendientes-admin.js'),\n  welcome: read('js/admin/content/control-bienvenida-admin.js'),`,
    `  adminGuard: read('js/admin/proteccion-cambios-pendientes-admin.js'),\n  contentAdmin: read('js/admin/content/gestion-contenido-admin.js'),\n  welcome: read('js/admin/content/control-bienvenida-admin.js'),`,
    'archivo de contenido en auditoría integral'
  );
}
if (!integral.includes("files.contentAdmin.includes('`content:${currentPageId}:${currentSectionId}`')")) {
  integral = replaceRequired(
    integral,
    `    "'email-template-editor'",\n    \`content:\${pageId}:\${sectionId}\`,\n    "'primary-editor'",\n  ].every(token => files.admin.includes(token)) &&\n    files.welcome.includes("'welcome-config'"),`,
    `    "'email-template-editor'",\n    "'primary-editor'",\n  ].every(token => files.admin.includes(token)) &&\n    files.contentAdmin.includes('\`content:\${currentPageId}:\${currentSectionId}\`') &&\n    files.contentAdmin.includes('window.AdminUnsaved.register(nextId') &&\n    files.contentAdmin.includes('window.AdminUnsaved?.markDirty(activeUnsavedScopeId)') &&\n    files.welcome.includes("'welcome-config'"),`,
    'registro integral de contenido'
  );
}
write('scripts/auditar-integral-plataforma.js', integral);

let unified = read('scripts/auditar-admin-apariencia-unificada.js');
if (!unified.includes('Contenido usa el guard global de cambios pendientes')) {
  unified = replaceRequired(
    unified,
    `check('Firebase sigue centralizado', firebase.includes('initializeApp') && !content.includes('initializeApp(') && !app.includes('initializeApp('));`,
    `check('Firebase sigue centralizado', firebase.includes('initializeApp') && !content.includes('initializeApp(') && !app.includes('initializeApp('));\ncheck('Contenido usa el guard global de cambios pendientes', content.includes('window.AdminUnsaved.register(nextId') && content.includes('window.AdminUnsaved?.markDirty(activeUnsavedScopeId)') && content.includes('window.AdminUnsaved?.markClean(activeUnsavedScopeId)'));\ncheck('No existe un beforeunload duplicado dentro de Contenido', !content.includes("window.addEventListener('beforeunload'"));`,
    'auditoría unificada del guard'
  );
}
write('scripts/auditar-admin-apariencia-unificada.js', unified);

console.log('Contenido integrado al guard único del panel.');
