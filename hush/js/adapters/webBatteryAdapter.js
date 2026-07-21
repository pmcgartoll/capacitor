/**
 * BatteryPort backed by navigator.getBattery when available.
 * Falls back to a controllable in-memory snapshot (Safari / Playwright).
 */

/** @typedef {{ level: number, charging: boolean }} BatterySnapshot */

export class WebBatteryAdapter {
  /**
   * @param {BatterySnapshot} [initial]
   * @param {{ allowNative?: boolean }} [options]
   */
  constructor(initial = { level: 1, charging: false }, options = {}) {
    this._snapshot = {
      level: clamp01(initial.level),
      charging: Boolean(initial.charging)
    };
    /** @type {Set<(s: BatterySnapshot) => void>} */
    this._listeners = new Set();
    this._native = null;
    this._usingNative = false;
    this._allowNative = options.allowNative !== false;
    this._ready = this._allowNative ? this._initNative() : Promise.resolve();
  }

  /** Promise that resolves once native battery probe finishes. */
  get ready() {
    return this._ready;
  }

  get usingNative() {
    return this._usingNative;
  }

  getSnapshot() {
    return { ...this._snapshot };
  }

  /**
   * @param {(snap: BatterySnapshot) => void} listener
   * @returns {() => void}
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Controllable API for Safari fallback + Playwright.
   * @param {Partial<BatterySnapshot>} patch
   */
  setSnapshot(patch) {
    if (typeof patch.level === 'number') this._snapshot.level = clamp01(patch.level);
    if (typeof patch.charging === 'boolean') this._snapshot.charging = patch.charging;
    this._emit();
  }

  async _initNative() {
    if (typeof navigator === 'undefined' || typeof navigator.getBattery !== 'function') {
      this._usingNative = false;
      return;
    }
    try {
      const battery = await navigator.getBattery();
      this._native = battery;
      this._usingNative = true;
      this._pullNative();
      battery.addEventListener('levelchange', () => this._pullNative());
      battery.addEventListener('chargingchange', () => this._pullNative());
    } catch (_) {
      this._usingNative = false;
    }
  }

  _pullNative() {
    if (!this._native) return;
    this._snapshot = {
      level: clamp01(this._native.level),
      charging: Boolean(this._native.charging)
    };
    this._emit();
  }

  _emit() {
    const snap = this.getSnapshot();
    for (const listener of this._listeners) listener(snap);
  }
}

function clamp01(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
