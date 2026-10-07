// Cada clic conserva sólo las etapas ya verificadas de su propio avance.
// Un nuevo clic empieza vacío; la validación comercial del servidor permanece
// independiente. Las dos guardias pueden hacer replay sin reenviarse en bucle.
const validations = new WeakMap();
const activeReplays = new WeakMap();

export function hasForwardValidation(event, control, stage) {
  if (!validations.has(event)) {
    validations.set(event, new Set(activeReplays.get(control) || []));
  }
  return validations.get(event).has(stage);
}

export function replayValidatedForward(control, event, stage) {
  const stages = new Set(validations.get(event) || []);
  stages.add(stage);
  activeReplays.set(control, stages);
  try { control.click(); }
  finally { activeReplays.delete(control); }
}
