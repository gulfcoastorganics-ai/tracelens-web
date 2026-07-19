export function createDebouncedTask(callback, delay = 120) {
  let timer = null;
  let sequence = 0;
  const run = (...args) => {
    sequence += 1;
    const current = sequence;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (current === sequence) callback(...args); }, delay);
  };
  run.cancel = () => { sequence += 1; if (timer !== null) clearTimeout(timer); timer = null; };
  run.flush = (...args) => { run.cancel(); callback(...args); };
  return run;
}
