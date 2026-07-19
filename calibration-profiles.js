const PROFILE_KEY = "tracelens-calibration-profiles-v1";
const defaults = ["Living Room Wall", "Garage Door", "Tattoo Chair", "Canvas Stand", "Workshop Table"];

export class CalibrationProfiles {
  constructor() { this.profiles = this.read(); }
  read() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; } }
  save(name, data) { this.profiles[name] = { name, ...data, updatedAt: Date.now() }; localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profiles)); }
  names() { return [...new Set([...defaults, ...Object.keys(this.profiles)])]; }
  get(name) { return this.profiles[name] || null; }
}
