import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  batteryDetail,
  batteryPercentLabel,
  batteryVolumeMultiplier,
  effectiveGain,
  effectiveVolume
} from '../../js/core/batteryPolicy.js';

describe('batteryVolumeMultiplier', () => {
  it('returns full volume when charging regardless of level', () => {
    assert.equal(batteryVolumeMultiplier({ level: 0.05, charging: true }), 1);
  });

  it('returns 1.0 at or above 30%', () => {
    assert.equal(batteryVolumeMultiplier({ level: 0.3, charging: false }), 1);
    assert.equal(batteryVolumeMultiplier({ level: 0.9, charging: false }), 1);
  });

  it('returns 0.8 between 20% and 30%', () => {
    assert.equal(batteryVolumeMultiplier({ level: 0.2, charging: false }), 0.8);
    assert.equal(batteryVolumeMultiplier({ level: 0.29, charging: false }), 0.8);
  });

  it('returns 0.55 between 10% and 20%', () => {
    assert.equal(batteryVolumeMultiplier({ level: 0.1, charging: false }), 0.55);
    assert.equal(batteryVolumeMultiplier({ level: 0.19, charging: false }), 0.55);
  });

  it('returns 0.3 below 10%', () => {
    assert.equal(batteryVolumeMultiplier({ level: 0.09, charging: false }), 0.3);
    assert.equal(batteryVolumeMultiplier({ level: 0, charging: false }), 0.3);
  });
});

describe('labels and gain', () => {
  it('formats percent labels', () => {
    assert.equal(batteryPercentLabel({ level: 0.72, charging: false }), '72%');
  });

  it('describes charging and low bands', () => {
    assert.match(batteryDetail({ level: 0.5, charging: true }), /Charging/);
    assert.match(batteryDetail({ level: 0.08, charging: false }), /Critical/);
  });

  it('computes effective volume and gain', () => {
    assert.equal(effectiveVolume(1, 0.55), 0.55);
    assert.ok(Math.abs(effectiveGain(1, 1) - 0.55) < 1e-9);
  });
});
