const DEFAULT_STATE = Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 0.55, flipped: false, blendMode: "Normal", guide: "none", physicalCalibration: null, perspective: null, trace: { enabled: false, mode: "Original", settings: {}, stage: 0, focus: null, contourProgress: {} } });

function newId() {
  return globalThis.crypto?.randomUUID?.() || `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createLayer({ id = newId(), name = "Reference image", image, ...state } = {}) {
  if (!image) throw new Error("A layer requires an image.");
  return { id, name, image, visible: true, locked: false, ...DEFAULT_STATE, ...state };
}

export function normalizeLayer(layer) {
  return createLayer({ ...layer, visible: layer.visible !== false, locked: Boolean(layer.locked) });
}

export function duplicateLayer(layer, name = `${layer.name} copy`) {
  return normalizeLayer({ ...layer, id: newId(), name });
}

export function cloneLayers(layers = []) {
  return layers.map(layer => normalizeLayer({ ...layer }));
}

export { DEFAULT_STATE };
