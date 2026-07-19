const DB_NAME = "tracelens-projects";
const STORE_NAME = "projects";

export class ProjectLibrary {
  constructor() { this.dbPromise = null; }
  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }
  async put(project) { const db = await this.open(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).put(project); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
  async all() { const db = await this.open(); return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll(); request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt)); request.onerror = () => reject(request.error); }); }
  async remove(id) { const db = await this.open(); return new Promise((resolve, reject) => { const tx = db.transaction(STORE_NAME, "readwrite"); tx.objectStore(STORE_NAME).delete(id); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
  async get(id) { const db = await this.open(); return new Promise((resolve, reject) => { const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
}
