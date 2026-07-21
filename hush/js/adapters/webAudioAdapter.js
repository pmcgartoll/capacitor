/**
 * Web Audio implementation of AudioPort.
 * Generates continuous white noise with an AudioWorklet-free ScriptProcessor
 * fallback path using a BufferSource loop of noise (gapless enough for ambient).
 *
 * For production iOS lock-screen reliability, swap this for NativeAudioAdapter.
 */

export class WebAudioAdapter {
  constructor() {
    /** @type {AudioContext | null} */
    this._ctx = null;
    /** @type {GainNode | null} */
    this._gainNode = null;
    /** @type {AudioBufferSourceNode | null} */
    this._source = null;
    this._gain = 0.3;
    this._playing = false;
  }

  isPlaying() {
    return this._playing;
  }

  /**
   * @param {number} gain 0..1
   */
  setGain(gain) {
    this._gain = clamp01(gain);
    if (this._gainNode && this._ctx) {
      const t = this._ctx.currentTime;
      this._gainNode.gain.cancelScheduledValues(t);
      this._gainNode.gain.setTargetAtTime(this._gain, t, 0.015);
    }
  }

  async start() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('Web Audio is not supported in this browser.');

    if (!this._ctx) {
      this._ctx = new Ctx();
      this._gainNode = this._ctx.createGain();
      this._gainNode.gain.value = this._gain;
      this._gainNode.connect(this._ctx.destination);
    }

    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }

    if (this._source) {
      try { this._source.stop(); } catch (_) { /* already stopped */ }
      this._source.disconnect();
      this._source = null;
    }

    const buffer = createNoiseBuffer(this._ctx, 2);
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this._gainNode);
    source.start();
    this._source = source;
    this._playing = true;
  }

  stop() {
    if (this._source) {
      try { this._source.stop(); } catch (_) { /* ignore */ }
      this._source.disconnect();
      this._source = null;
    }
    this._playing = false;
  }
}

/**
 * @param {AudioContext} ctx
 * @param {number} seconds
 */
function createNoiseBuffer(ctx, seconds) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Simple LCG — same spirit as the Swift NoiseRNG, avoids Math.random in hot loops later if we switch.
  let state = 0xc0ffee >>> 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = (state / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

function clamp01(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
