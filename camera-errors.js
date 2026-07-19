export function classifyCameraError(error, { secureContext = globalThis.isSecureContext } = {}) {
  const name = error?.name || "";
  if (secureContext === false) return { code: "insecure-context", message: "Camera requires an HTTPS page." };
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return { code: "permission-denied", message: "Camera permission was denied. Allow access or use Import." };
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return { code: "no-device", message: "No camera was found. Import an image instead." };
  if (name === "NotReadableError" || name === "TrackStartError") return { code: "busy", message: "The camera is busy in another app. Retry when it is available." };
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") return { code: "constraints", message: "This camera does not support the requested mode. Try switching cameras." };
  if (!globalThis.navigator?.mediaDevices?.getUserMedia) return { code: "unsupported", message: "Camera access is not supported in this browser." };
  return { code: "unknown", message: "Camera could not start. Retry or import an image." };
}
