import assert from "node:assert/strict";
import { AppStateMachine, APP_STATES } from "../app-state-machine.js";
import { DEFAULT_FEATURE_FLAGS, featureEnabled, normalizeFeatureFlags } from "../feature-flags.js";

const machine = new AppStateMachine();
assert.deepEqual(APP_STATES[0], "Booting");
assert.equal(machine.canTransition("Home"), true);
machine.transition("Home"); machine.transition("Importing"); machine.transition("PreparingImage"); machine.transition("Positioning"); machine.transition("Tracing"); machine.transition("Paused"); machine.transition("Tracing");
assert.equal(machine.history.length, 7);
assert.throws(() => machine.transition("Booting"), /Invalid application transition/);
assert.equal(machine.tryTransition("Booting"), null);
assert.equal(machine.state, "Tracing");
const flags = normalizeFeatureFlags({ segmentation: true, guidedTracing: false });
assert.equal(flags.segmentation, true); assert.equal(flags.guidedTracing, false); assert.equal(flags.voiceCommands, DEFAULT_FEATURE_FLAGS.voiceCommands); assert.equal(featureEnabled(flags, "segmentation"), true); assert.equal(featureEnabled(flags, "unknown"), false);
console.log("application state and feature flag tests passed");
