const ONBOARDING_KEY = "tracelens-gesture-coach-v1";

export class GestureCoach {
  constructor(element, { reducedMotion = false } = {}) { this.element = element; this.reducedMotion = reducedMotion; this.dismissed = globalThis.localStorage?.getItem(ONBOARDING_KEY) === "done"; this.timer = null; this.hideTimer = null; }
  show() { if (this.dismissed || !this.element) return; window.clearTimeout(this.timer); window.clearTimeout(this.hideTimer); this.element.hidden = false; this.element.classList.add("visible"); this.timer = window.setTimeout(() => this.dismiss(), this.reducedMotion ? 3500 : 6500); }
  dismiss() { if (!this.element) return; this.dismissed = true; globalThis.localStorage?.setItem(ONBOARDING_KEY, "done"); this.element.classList.remove("visible"); window.clearTimeout(this.timer); window.clearTimeout(this.hideTimer); this.hideTimer = window.setTimeout(() => { this.element.hidden = true; }, this.reducedMotion ? 0 : 220); }
  replay() { this.dismissed = false; globalThis.localStorage?.removeItem(ONBOARDING_KEY); this.show(); }
}
