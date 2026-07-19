export const GUIDED_LAYER_TYPES = Object.freeze([
  "Construction", "Outline", "Major detail", "Minor detail", "Shadow", "Highlight", "Texture", "Final cleanup"
]);

export const DEFAULT_GUIDED_LAYERS = Object.freeze(GUIDED_LAYER_TYPES.map((name, index) => ({ id: `guide-${index + 1}`, name, order: index, visible: index < 2, opacity: index === 0 ? .45 : 1, locked: false, completed: false, notes: "", progress: 0 })));

export const DEFAULT_LESSON_STEPS = Object.freeze([
  { id: "composition", title: "Block the composition", description: "Establish the outer silhouette and main proportions.", layer: "Construction", dependencies: [], estimatedMinutes: 5 },
  { id: "outline", title: "Trace the outline", description: "Follow the most important outer contours.", layer: "Outline", dependencies: ["composition"], estimatedMinutes: 8 },
  { id: "major-detail", title: "Add major details", description: "Place the large internal forms before fine detail.", layer: "Major detail", dependencies: ["outline"], estimatedMinutes: 10 },
  { id: "shadows", title: "Map the shadows", description: "Use broad shadow shapes to describe volume.", layer: "Shadow", dependencies: ["major-detail"], estimatedMinutes: 8 },
  { id: "cleanup", title: "Finish and clean up", description: "Review the reference and refine the drawing.", layer: "Final cleanup", dependencies: ["shadows"], estimatedMinutes: 8 }
]);

export function createGuidedState(input = {}) {
  const layers = Array.isArray(input.layers) && input.layers.length ? input.layers : DEFAULT_GUIDED_LAYERS;
  const steps = Array.isArray(input.steps) && input.steps.length ? input.steps : DEFAULT_LESSON_STEPS;
  return {
    enabled: Boolean(input.enabled),
    layers: layers.map((layer, index) => ({
      ...DEFAULT_GUIDED_LAYERS[index % DEFAULT_GUIDED_LAYERS.length],
      ...layer,
      order: Number.isFinite(Number(layer.order)) ? Number(layer.order) : index,
      progress: clamp(Number(layer.progress), 0, 1)
    })),
    steps: steps.map(step => ({ ...step, completed: Boolean(step.completed), skipped: Boolean(step.skipped) })),
    activeStep: Math.max(0, Math.min(steps.length - 1, Number(input.activeStep) || 0)),
    autoAdvance: Boolean(input.autoAdvance),
    sessionProgress: clamp(Number(input.sessionProgress), 0, 1),
    updatedAt: Number(input.updatedAt) || 0
  };
}

export function canCompleteStep(state, index = state?.activeStep || 0) {
  const normalized = createGuidedState(state); const step = normalized.steps[index];
  return Boolean(step && step.dependencies.every(id => normalized.steps.find(candidate => candidate.id === id)?.completed));
}

export function completeStep(state, index = state?.activeStep || 0) {
  const next = createGuidedState(state); if (!canCompleteStep(next, index)) return next;
  next.steps[index].completed = true; next.steps[index].skipped = false; next.sessionProgress = next.steps.filter(step => step.completed).length / next.steps.length; next.updatedAt = Date.now(); if (next.autoAdvance && index < next.steps.length - 1) next.activeStep = index + 1; return next;
}

export function setStep(state, index) { const next = createGuidedState(state); next.activeStep = Math.max(0, Math.min(next.steps.length - 1, Number(index) || 0)); return next; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
