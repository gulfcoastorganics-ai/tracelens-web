import assert from "node:assert/strict";
import { validateQuad, cornerMotion } from "../quad-geometry.js";
import { TrackingState } from "../tracking-state.js";
import { PerspectiveSession } from "../perspective-session.js";

const good = [{ x: .12, y: .12 }, { x: .88, y: .14 }, { x: .86, y: .86 }, { x: .14, y: .88 }];
assert.equal(validateQuad(good).valid, true);
assert.equal(validateQuad([{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .1, y: .9 }, { x: .9, y: .9 }]).valid, false, "crossed quads reject");
assert.equal(validateQuad([{ x: .01, y: .1 }, { x: .99, y: .1 }, { x: .99, y: .2 }, { x: .01, y: .2 }]).valid, false, "edge slivers reject");
assert.equal(validateQuad([{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .12 }, { x: .1, y: .12 }]).valid, false, "tiny area rejects");
assert.equal(cornerMotion(good, good.map(point => ({ x: point.x + .01, y: point.y }))) < .055, true);

const state = new TrackingState({ acquireAt: 80, retainAt: 55, graceMs: 100 });
assert.equal(state.update(70, 0, false).state, "searching", "acquire threshold is higher than retain");
assert.equal(state.update(82, 10, false).state, "tracking");
assert.equal(state.update(60, 20, true).state, "tracking", "retain threshold holds lock");
assert.equal(state.update(20, 200, true).state, "lost", "loss waits through grace window");

const session = new PerspectiveSession(4);
session.beginScan();
assert.equal(session.confirm(), false, "stale/no candidate cannot lock");
session.updateCandidate({ lockEligible: true, stableSampleCount: 3 });
assert.equal(session.confirm(), false, "insufficient samples cannot lock");
session.updateCandidate({ lockEligible: true, stableSampleCount: 4 });
assert.equal(session.confirm(), true);
assert.equal(session.locked, true);
session.unlock();
assert.equal(session.locked, false);
session.beginScan(); session.cancel(); assert.equal(session.confirm(), false, "cancelled scan cannot lock");
console.log("false-positive geometry/state tests passed");
