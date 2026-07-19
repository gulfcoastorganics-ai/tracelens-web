export function resolveOverlayDisplay({ visible = true, perspective = false } = {}) {
  return { overlay: Boolean(visible && !perspective), perspective: Boolean(visible && perspective) };
}
