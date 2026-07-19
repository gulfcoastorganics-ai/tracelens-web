export async function registerPWA({ onUpdate } = {}) {
  if (!navigator.serviceWorker?.register) return null;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    if (registration.waiting) onUpdate?.({ registration, activate: () => activateUpdate(registration) });
    registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdate?.({ registration, activate: () => activateUpdate(registration) }); }); });
    return registration;
  } catch (error) { console.error("[TraceLens PWA] service worker registration failed", error); return null; }
}

let updateReloading = false;
export function activateUpdate(registration) {
  const waiting = registration?.waiting;
  if (!waiting) return false;
  const onControllerChange = () => { if (updateReloading) return; updateReloading = true; window.location.reload(); };
  navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
  waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
