export const TRACE_STAGES = [
  { name: "Composition", detail: "Outer silhouette and major proportions", blur: 3, thresholdBias: .12 },
  { name: "Primary forms", detail: "Large curves and boundaries", blur: 2, thresholdBias: .07 },
  { name: "Secondary forms", detail: "Interior structure and major details", blur: 1, thresholdBias: .02 },
  { name: "Fine detail", detail: "Small contours and texture", blur: 0, thresholdBias: -.05 },
  { name: "Tonal guide", detail: "Simplified shadow and highlight regions", blur: 1, thresholdBias: .04 }
];

export function getTraceStage(index = 0) { return TRACE_STAGES[Math.max(0, Math.min(TRACE_STAGES.length - 1, Number(index) || 0))]; }
