/** Coalesces resize/orientation/toolbar signals into one geometry update. */
export function createViewportCoordinator({ onUpdate, schedule = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame } = {}) {
  let pending = 0;
  const flush = () => { pending = 0; onUpdate?.(); };
  return {
    schedule() {
      if (pending) return pending;
      if (typeof schedule !== "function") { flush(); return 0; }
      pending = schedule(flush);
      return pending;
    },
    flush,
    cancel() { if (pending && typeof cancel === "function") cancel(pending); pending = 0; },
    get pending() { return Boolean(pending); }
  };
}
