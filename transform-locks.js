export class TransformLocks {
  constructor() { this.position = false; this.rotation = false; this.scale = false; this.perspective = false; }
  toggle(name) { this[name] = !this[name]; return this[name]; }
  canEdit(name) { return !this[name]; }
}
