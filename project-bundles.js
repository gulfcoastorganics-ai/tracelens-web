const FORMAT = "tracelens-project";
const VERSION = 1;

export function createProjectBundle(project) { return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), project }; }
export function validateProjectBundle(bundle) { return Boolean(bundle && bundle.format === FORMAT && bundle.project?.image && Number(bundle.version) <= VERSION); }
export function downloadProjectBundle(bundle, filename = "tracelens-project.json") {
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
