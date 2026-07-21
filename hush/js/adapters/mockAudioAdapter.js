/**
 * AudioPort stub for Playwright / environments without usable Web Audio.
 */
export class MockAudioAdapter {
  constructor() {
    this._gain = 0;
    this._playing = false;
    this.starts = 0;
    this.stops = 0;
  }

  isPlaying() {
    return this._playing;
  }

  setGain(gain) {
    this._gain = typeof gain === 'number' ? gain : 0;
  }

  getGain() {
    return this._gain;
  }

  async start() {
    this.starts += 1;
    this._playing = true;
  }

  stop() {
    this.stops += 1;
    this._playing = false;
  }
}
