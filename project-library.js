const DB_NAME = "tracelens-projects";
const STORE_NAME = "projects";

export class ProjectLibrary {
  constructor() { this.dbPromise = null; }
  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 3);
      request.onupgradeneeded = event => { const store = request.result.objectStoreNames.contains(STORE_NAME) ? request.transaction.objectStore(STORE_NAME) : request.result.createObjectStore(STORE_NAME, { keyPath: "id" }); if (event.oldVersion < 3) { const cursorRequest = store.openCursor(); cursorRequest.onsuccess = () => { const cursor = cursorRequest.result; if (!cursor) return; const value = cursor.value; cursor.update({ createdAt: value.createdAt || value.updatedAt || Date.now(), updatedAt: value.updatedAt || value.createdAt || Date.now(), favorite: Boolean(value.favorite), archived: Boolean(value.archived), schemaVersion: value.schemaVersion || 1, ...value }); cursor.continue(); }; } };
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); this.dbPromise = null; }; resolve(db); }; request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error("Project database upgrade is blocked."));
    }).catch(error => { this.dbPromise = null; throw error; });
    return this.dbPromise;
  }
  async put(project) { if (!project?.id) throw new Error("Project id is required"); const db = await this.open(); return new Promise((resolve, reject) => { const now = Date.now(); const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).put({ createdAt: project.createdAt || now, updatedAt: project.updatedAt || now, favorite: false, archived: false, schemaVersion: 2, ...project }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
  async all({ includeArchived = false } = {}) { const db = await this.open(); return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll(); request.onsuccess = () => resolve(request.result.filter(project => project?.id && (includeArchived || !project.archived)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))); request.onerror = () => reject(request.error); }); }
  async remove(id) { const db = await this.open(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
  async get(id) { const db = await this.open(); return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async patch(id, changes) { const project = await this.get(id); if (!project) throw new Error("Project not found"); return this.put({ ...project, ...changes, id, updatedAt: Date.now() }); }
  async thumbnail(dataUrl, maxSize = 180) { return new Promise(resolve => { const image = new Image(); image.onload = () => { const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio)); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", .72)); }; image.onerror = () => resolve(dataUrl); image.src = dataUrl; }); }
}
