/** Serial async queue for trace jobs; callers decide debounce/cancellation policy. */
export function createTraceQueue({ process, onError } = {}) {
  let generation = 0;
  let running = false;
  return {
    start(layers = [], activeLayerId = null) {
      const current = ++generation;
      const pending = layers.filter(layer => layer?.id === activeLayerId || (layer?.visible !== false && layer?.trace?.enabled && layer.trace.mode !== "Original"));
      pending.sort((a, b) => Number(b.id === activeLayerId) - Number(a.id === activeLayerId));
      running = true;
      const promise = (async () => {
        for (const layer of pending) {
          if (current !== generation) break;
          try { await process?.(layer, { isCurrent: () => current === generation }); } catch (error) { onError?.(error, layer); }
        }
      })().finally(() => { if (current === generation) running = false; });
      return promise;
    },
    cancel() { generation += 1; running = false; },
    get running() { return running; }
  };
}
