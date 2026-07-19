const SESSION_LIMIT = 500;

export const SESSION_STATES = Object.freeze(["idle", "recording", "paused", "stopped"]);

function timestamp(value) { return Number.isFinite(Number(value)) ? Number(value) : Date.now(); }

export function createSessionState(input = {}) {
  const state = {
    version: 1,
    id: input.id || null,
    status: SESSION_STATES.includes(input.status) ? input.status : "idle",
    startedAt: timestamp(input.startedAt || 0),
    pausedAt: timestamp(input.pausedAt || 0),
    endedAt: timestamp(input.endedAt || 0),
    pausedMs: Math.max(0, Number(input.pausedMs) || 0),
    events: Array.isArray(input.events) ? input.events.slice(-SESSION_LIMIT).map(event => ({ ...event })) : [],
    updatedAt: timestamp(input.updatedAt || 0)
  };
  if (state.status === "idle") { state.startedAt = 0; state.pausedAt = 0; state.endedAt = 0; }
  return state;
}

export function startSession(input = {}, now = Date.now()) {
  const previous = createSessionState(input);
  return { ...previous, id: previous.id || `session-${now}`, status: "recording", startedAt: previous.startedAt || now, pausedAt: 0, endedAt: 0, updatedAt: now };
}

export function pauseSession(input = {}, now = Date.now()) {
  const state = createSessionState(input);
  if (state.status !== "recording") return state;
  return { ...state, status: "paused", pausedAt: now, updatedAt: now };
}

export function resumeSession(input = {}, now = Date.now()) {
  const state = createSessionState(input);
  if (state.status !== "paused") return state;
  return { ...state, status: "recording", pausedMs: state.pausedMs + Math.max(0, now - state.pausedAt), pausedAt: 0, updatedAt: now };
}

export function stopSession(input = {}, now = Date.now()) {
  const state = createSessionState(input);
  if (state.status === "paused") return { ...state, status: "stopped", endedAt: now, pausedMs: state.pausedMs + Math.max(0, now - state.pausedAt), pausedAt: 0, updatedAt: now };
  if (state.status !== "recording") return state;
  return { ...state, status: "stopped", endedAt: now, updatedAt: now };
}

export function recordSessionEvent(input = {}, type, detail = {}, now = Date.now()) {
  const state = createSessionState(input);
  if (state.status !== "recording" || !type) return state;
  const event = { id: `${now}-${state.events.length}`, type: String(type), at: now, detail: typeof detail === "string" ? detail : { ...detail } };
  return { ...state, events: [...state.events, event].slice(-SESSION_LIMIT), updatedAt: now };
}

export function sessionDuration(input = {}, now = Date.now()) {
  const state = createSessionState(input);
  if (!state.startedAt) return 0;
  const end = state.endedAt || now;
  const pausedMs = state.pausedMs + (state.status === "paused" ? Math.max(0, now - state.pausedAt) : 0);
  return Math.max(0, end - state.startedAt - pausedMs);
}

export function milestones(input = {}) {
  return createSessionState(input).events.filter(event => /completed|calibrated|captured|saved|comparison/i.test(event.type));
}

export function replayAt(input = {}, elapsedMs = 0) {
  const state = createSessionState(input);
  const target = state.startedAt + Math.max(0, Number(elapsedMs) || 0);
  return state.events.filter(event => event.at <= target);
}

export { SESSION_LIMIT };
