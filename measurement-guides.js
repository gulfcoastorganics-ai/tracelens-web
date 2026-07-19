export class MeasurementGuides {
  constructor(element) { this.element = element; }
  setMode(mode) { if (!this.element) return; this.element.dataset.guide = mode; this.element.classList.toggle("visible", mode !== "none"); }
}
