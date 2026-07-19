import { composeTrace } from "./trace-filters.js";

self.onmessage = event => {
  const { id, image, settings } = event.data;
  try { const result = composeTrace(image, settings); self.postMessage({ id, result }, [result.data.buffer]); }
  catch (error) { self.postMessage({ id, error: error?.message || "Trace processing failed" }); }
};
