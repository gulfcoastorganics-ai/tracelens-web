export class MeasurementGuides {
  constructor(element) { this.element = element; }
  setMode(mode) { this.element.dataset.guide = mode; this.element.classList.toggle("visible", mode !== "none"); }
}
