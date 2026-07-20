/** Portable project JSON boundary with validation and schema migration. */
const FORMAT = "tracelens-project";
const VERSION = 2;
const MAX_PROJECT_NAME = 120;

function validImageReference(value) { return typeof value === "string" && value.length > 0 && value.length <= 50 * 1024 * 1024 && /^(data:image\/[a-z0-9.+-]+;base64,|blob:|https?:\/\/)/i.test(value); }

export function createProjectBundle(project) { return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), project: { ...project, schemaVersion: VERSION } }; }
export function migrateProjectBundle(bundle) {
  if (!bundle || bundle.format !== FORMAT || !bundle.project || !Number.isInteger(Number(bundle.version)) || Number(bundle.version) > VERSION || Number(bundle.version) < 1) return null;
  if (!bundle.project.image && !Array.isArray(bundle.project.layers)) return null;
  const project = { ...bundle.project, schemaVersion: VERSION };
  if (Array.isArray(project.layers)) {
    project.layers = project.layers.filter(layer => layer && typeof layer === "object" && validImageReference(layer.image));
    if (!project.layers.length) return null;
    project.image ||= project.layers.find(layer => layer.image)?.image;
  }
  if (!Array.isArray(project.layers) && validImageReference(project.image)) project.layers = [{ id: `legacy-${Date.now()}`, name: project.name || "Reference image", image: project.image, x: project.x || 0, y: project.y || 0, scale: project.scale || 1, rotation: project.rotation || 0, opacity: project.opacity ?? .55, flipped: Boolean(project.flipped), blendMode: project.blendMode || "Normal", guide: project.guide || "none", visible: true, locked: Boolean(project.locks?.position) }];
  if (!Array.isArray(project.layers)) return null;
  project.name = typeof project.name === "string" ? project.name.trim().slice(0, MAX_PROJECT_NAME) || "Untitled project" : "Untitled project";
  project.activeLayerId ||= project.layers[project.layers.length - 1]?.id;
  return { ...bundle, version: VERSION, project };
}
export function validateProjectBundle(bundle) { return Boolean(migrateProjectBundle(bundle)); }
export function downloadProjectBundle(bundle, filename = "tracelens-project.json") {
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.rel = "noopener"; document.body.append(anchor); anchor.click(); window.setTimeout(() => { URL.revokeObjectURL(url); anchor.remove(); }, 1000);
}
