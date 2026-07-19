export function workspaceFingerprint(state) {
  return JSON.stringify(state, (key, value) => key === "image" || key === "thumbnail" ? undefined : value);
}
