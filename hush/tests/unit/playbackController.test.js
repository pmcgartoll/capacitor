import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackController } from '../../js/core/playbackController.js';

class FakeAudio {
  constructor() {
    this.gain = 0;
    this.playing = false;
    this.starts = 0;
  }
  async start() {
    this.starts += 1;
    this.playing = true;
  }
  stop() {
    this.playing = false;
  }
  setGain(g) {
    this.gain = g;
  }
  isPlaying() {
    return this.playing;
  }
}

class FakeBattery {
  constructor(snap) {
    this.snap = snap;
    this.listeners = new Set();
  }
  getSnapshot() {
    return { ...this.snap };
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  set(snap) {
    this.snap = { ...this.snap, ...snap };
    for (const fn of this.listeners) fn(this.getSnapshot());
  }
}

describe('PlaybackController', () => {
  it('starts and stops via the audio port', async () => {
    const audio = new FakeAudio();
    const battery = new FakeBattery({ level: 1, charging: false });
    const ctl = new PlaybackController(audio, battery, { userVolume: 1 });

    await ctl.start();
    assert.equal(ctl.getState().isPlaying, true);
    assert.equal(audio.starts, 1);

    ctl.stop();
    assert.equal(ctl.getState().isPlaying, false);
    assert.equal(audio.playing, false);
    ctl.dispose();
  });

  it('reduces gain when battery drops below thresholds', async () => {
    const audio = new FakeAudio();
    const battery = new FakeBattery({ level: 1, charging: false });
    const ctl = new PlaybackController(audio, battery, { userVolume: 1 });
    const fullGain = audio.gain;

    battery.set({ level: 0.15 });
    assert.equal(ctl.getState().batteryMultiplier, 0.55);
    assert.ok(audio.gain < fullGain);

    battery.set({ level: 0.15, charging: true });
    assert.equal(ctl.getState().batteryMultiplier, 1);
    assert.ok(Math.abs(audio.gain - fullGain) < 1e-9);
    ctl.dispose();
  });

  it('surfaces audio start errors', async () => {
    const audio = new FakeAudio();
    audio.start = async () => {
      throw new Error('blocked');
    };
    const battery = new FakeBattery({ level: 1, charging: false });
    const ctl = new PlaybackController(audio, battery);
    await ctl.start();
    assert.equal(ctl.getState().isPlaying, false);
    assert.equal(ctl.getState().errorMessage, 'blocked');
    ctl.dispose();
  });
});
