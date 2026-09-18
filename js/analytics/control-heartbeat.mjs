export const MIN_HEARTBEAT_INTERVAL_MS = 20_000;

export function heartbeatDecision({
  inFlight = false,
  lastWriteAt = 0,
  now = Date.now(),
  minIntervalMs = MIN_HEARTBEAT_INTERVAL_MS
} = {}) {
  if (inFlight) return { allowed: false, reason: 'in-flight' };
  if (lastWriteAt && now - lastWriteAt < minIntervalMs) {
    return { allowed: false, reason: 'rule-throttle-window' };
  }
  return { allowed: true, reason: 'eligible' };
}
