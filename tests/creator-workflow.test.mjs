import assert from "node:assert/strict";
import { activeRegion, addRegion, completeRegion, createRegionState, regionContainsPoint, removeRegion, setActiveRegion } from "../regions.js";
import { createSessionState, milestones, pauseSession, recordSessionEvent, replayAt, resumeSession, sessionDuration, startSession, stopSession } from "../session-replay.js";
import { createLayer, cloneLayers } from "../layers.js";
import { createProjectBundle, migrateProjectBundle } from "../project-bundles.js";

let regions = createRegionState();
regions = addRegion(regions, { name: "Face", shape: "rectangle", points: [{ x: .1, y: .2 }, { x: .5, y: .7 }] });
assert.equal(regions.regions.length, 1);
assert.equal(regionContainsPoint(activeRegion(regions), { x: .3, y: .4 }), true);
assert.equal(regionContainsPoint(activeRegion(regions), { x: .8, y: .4 }), false);
regions = setActiveRegion(regions, regions.regions[0].id);
regions = completeRegion(regions, regions.activeRegionId);
assert.equal(activeRegion(regions).completed, true);
regions = removeRegion(regions, regions.activeRegionId);
assert.equal(regions.activeRegionId, null);

let session = startSession(createSessionState(), 1000);
session = recordSessionEvent(session, "Imported", { file: "reference.png" }, 1100);
session = pauseSession(session, 2100);
assert.equal(session.status, "paused");
session = resumeSession(session, 3100);
session = recordSessionEvent(session, "Region completed", { id: "r1" }, 3200);
session = stopSession(session, 4200);
assert.equal(session.status, "stopped");
assert.equal(sessionDuration(session, 5000), 2200);
assert.equal(milestones(session).length, 1);
assert.equal(replayAt(session, 2500).length, 2);

const layer = createLayer({ image: "data:image/png;base64,region", regions });
const copy = cloneLayers([layer])[0];
copy.regions.regions.push({ id: "local", name: "Local", shape: "rectangle", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
assert.equal(layer.regions.regions.length, 0, "region state must clone independently");
const restoredBundle = migrateProjectBundle(createProjectBundle({ image: layer.image, layers: [layer] }));
assert.equal(restoredBundle.project.layers[0].regions.regions.length, 0, "region state must survive bundle migration");
console.log("creator workflow region and session tests passed");
