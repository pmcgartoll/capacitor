import {
  batteryDetail,
  batteryPercentLabel,
  batteryVolumeMultiplier,
  effectiveGain,
  effectiveVolume
} from './batteryPolicy.js';

/**
 * Coordinates playback with battery-aware volume.
 * Depends only on AudioPort + BatteryPort — no DOM.
 */
export class PlaybackController {
  /**
   * @param {import('../ports/audioPort.js').AudioPort} audio
   * @param {import('../ports/batteryPort.js').BatteryPort} battery
   * @param {{ userVolume?: number, onChange?: (state: ReturnType<PlaybackController['getState']>) => void }} [options]
   */
  constructor(audio, battery, options = {}) {
    this._audio = audio;
    this._battery = battery;
    this._userVolume = clampVolume(options.userVolume ?? 0.55);
    this._onChange = typeof options.onChange === 'function' ? options.onChange : null;
    this._isPlaying = false;
    this._errorMessage = null;
    this._unsub = null;

    this._unsub = this._battery.subscribe(() => this._applyVolumePolicy());
    this._applyVolumePolicy();
  }

  dispose() {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
  }

  getState() {
    const battery = this._battery.getSnapshot();
    const multiplier = batteryVolumeMultiplier(battery);
    return {
      isPlaying: this._isPlaying,
      userVolume: this._userVolume,
      batteryMultiplier: multiplier,
      effectiveVolume: effectiveVolume(this._userVolume, multiplier),
      battery,
      batteryPercent: batteryPercentLabel(battery),
      batteryDetail: batteryDetail(battery),
      statusMessage: this._statusMessage(battery, multiplier),
      errorMessage: this._errorMessage
    };
  }

  async toggle() {
    if (this._isPlaying) {
      this.stop();
    } else {
      await this.start();
    }
  }

  async start() {
    this._errorMessage = null;
    try {
      this._applyVolumePolicy();
      await this._audio.start();
      this._isPlaying = true;
      this._emit();
    } catch (err) {
      this._isPlaying = false;
      this._errorMessage = err && err.message ? err.message : String(err);
      this._emit();
    }
  }

  stop() {
    this._audio.stop();
    this._isPlaying = false;
    this._emit();
  }

  /**
   * @param {number} value 0..1
   */
  setUserVolume(value) {
    this._userVolume = clampVolume(value);
    this._applyVolumePolicy();
  }

  _applyVolumePolicy() {
    const battery = this._battery.getSnapshot();
    const multiplier = batteryVolumeMultiplier(battery);
    const gain = effectiveGain(this._userVolume, multiplier);
    this._audio.setGain(gain);
    this._emit();
  }

  _statusMessage(battery, multiplier) {
    if (this._errorMessage) return 'Could not start audio';
    if (battery.charging) {
      return this._isPlaying ? 'Playing · charging — full volume' : 'Ready · charging';
    }
    if (multiplier < 1) {
      const pct = batteryPercentLabel(battery);
      return this._isPlaying
        ? `Playing · battery ${pct} — volume reduced`
        : `Ready · battery ${pct} — volume will reduce`;
    }
    return this._isPlaying ? 'Playing indefinitely' : 'Ready';
  }

  _emit() {
    if (this._onChange) this._onChange(this.getState());
  }
}

function clampVolume(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0.55;
  return Math.min(1, Math.max(0.05, n));
}
