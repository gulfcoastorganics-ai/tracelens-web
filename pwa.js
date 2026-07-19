export async function registerPWA({ onUpdate } = {}) {
  if (!navigator.serviceWorker?.register) return null;
  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    if (registration.waiting) onUpdate?.(registration);
    registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) onUpdate?.(registration); }); });
    return registration;
  } catch (error) { console.error("[TraceLens PWA] service worker registration failed", error); return null; }
}
