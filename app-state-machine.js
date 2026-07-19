export const APP_STATES = Object.freeze([
  "Booting", "Home", "Importing", "PreparingImage", "ScanningSurface", "Calibrating",
  "Positioning", "Tracing", "Paused", "Reviewing", "Comparing", "Exporting", "Saving", "Recovering", "Error"
]);

const DEFAULT_TRANSITIONS = Object.freeze({
  Booting: ["Home", "Recovering", "Error"],
  Home: ["Importing", "Recovering", "Error"],
  Importing: ["PreparingImage", "Home", "Error"],
  PreparingImage: ["Positioning", "Home", "Error"],
  ScanningSurface: ["Calibrating", "Positioning", "Paused", "Error"],
  Calibrating: ["Positioning", "ScanningSurface", "Paused", "Error"],
  Positioning: ["ScanningSurface", "Calibrating", "Tracing", "Comparing", "Saving", "Paused", "Home", "Error"],
  Tracing: ["Paused", "Reviewing", "Comparing", "Saving", "Positioning", "Home", "Error"],
  Paused: ["Tracing", "Positioning", "Reviewing", "Home", "Error"],
  Reviewing: ["Comparing", "Tracing", "Home", "Saving", "Error"],
  Comparing: ["Reviewing", "Tracing", "Saving", "Home", "Error"],
  Exporting: ["Reviewing", "Tracing", "Home", "Error"],
  Saving: ["Tracing", "Reviewing", "Home", "Error"],
  Recovering: ["Home", "Positioning", "Error"],
  Error: ["Recovering", "Home", "Importing"]
});

export class AppStateMachine {
  constructor({ initial = "Booting", transitions = DEFAULT_TRANSITIONS, onTransition, onInvalid } = {}) {
    if (!APP_STATES.includes(initial)) throw new Error(`Unknown application state: ${initial}`);
    this.state = initial;
    this.transitions = transitions;
    this.onTransition = onTransition;
    this.onInvalid = onInvalid;
    this.history = [];
  }

  canTransition(next) { return APP_STATES.includes(next) && (next === this.state || this.transitions[this.state]?.includes(next)); }

  transition(next, meta = {}) {
    if (!this.canTransition(next)) {
      const error = new Error(`Invalid application transition: ${this.state} → ${next}`);
      this.onInvalid?.({ from: this.state, to: next, meta, error });
      throw error;
    }
    const previous = this.state;
    this.state = next;
    const event = { from: previous, to: next, meta, at: Date.now() };
    if (previous !== next) this.history.push(event);
    this.onTransition?.(event);
    return event;
  }

  tryTransition(next, meta = {}) { try { return this.transition(next, meta); } catch { return null; } }

  reset(initial = "Booting") { if (!APP_STATES.includes(initial)) throw new Error(`Unknown application state: ${initial}`); this.state = initial; this.history.length = 0; }
}
