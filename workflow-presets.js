export const WORKFLOW_PRESETS = {
  Artist: { opacity: .55, blendMode: "Normal", guide: "none", gridSpacing: 3, snapSensitivity: .22, tracking: { weakAt: 58, lostAt: 35 } },
  Mural: { opacity: .48, blendMode: "Multiply", guide: "square", gridSpacing: 4, snapSensitivity: .16, tracking: { weakAt: 62, lostAt: 38 } },
  Tattoo: { opacity: .62, blendMode: "Multiply", guide: "center", gridSpacing: 3, snapSensitivity: .28, tracking: { weakAt: 55, lostAt: 30 } },
  Blueprint: { opacity: .42, blendMode: "Screen", guide: "square", gridSpacing: 5, snapSensitivity: .18, tracking: { weakAt: 65, lostAt: 42 } },
  "Sign & Vinyl": { opacity: .5, blendMode: "Normal", guide: "thirds", gridSpacing: 3, snapSensitivity: .12, tracking: { weakAt: 64, lostAt: 40 } },
  Photography: { opacity: .38, blendMode: "Difference", guide: "golden", gridSpacing: 3, snapSensitivity: .2, tracking: { weakAt: 60, lostAt: 36 } },
  Custom: { opacity: .55, blendMode: "Normal", guide: "none", gridSpacing: 3, snapSensitivity: .22, tracking: { weakAt: 58, lostAt: 35 } }
};

export function getWorkflowPreset(name) { return WORKFLOW_PRESETS[name] || WORKFLOW_PRESETS.Custom; }
