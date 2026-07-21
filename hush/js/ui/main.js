import { PlaybackController } from '../core/playbackController.js';
import { WebAudioAdapter } from '../adapters/webAudioAdapter.js';
import { MockAudioAdapter } from '../adapters/mockAudioAdapter.js';
import { WebBatteryAdapter } from '../adapters/webBatteryAdapter.js';
import { mountView } from './view.js';

function boot() {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app missing');

  const params = new URLSearchParams(window.location.search);
  const forceSim = params.has('sim') || params.get('battery') === 'mock';
  const useMockAudio = params.get('audio') === 'mock';

  const initialLevel = numParam(params.get('level'), 1);
  const initialCharging = params.get('charging') === '1' || params.get('charging') === 'true';

  const audio = useMockAudio ? new MockAudioAdapter() : new WebAudioAdapter();
  // When simulating (tests / Safari), never attach navigator.getBattery —
  // Chromium's native Battery API would overwrite controllable snapshots.
  const battery = new WebBatteryAdapter(
    { level: initialLevel, charging: initialCharging },
    { allowNative: !forceSim }
  );

  // Expose for Playwright / debugging (ports stay swappable).
  window.__hush = { audio, battery, useMockAudio };

  const view = mountView(root, {
    onToggle: () => controller.toggle(),
    onVolume: (v) => controller.setUserVolume(v),
    onSimLevel: (level) => battery.setSnapshot({ level }),
    onSimCharging: (charging) => battery.setSnapshot({ charging })
  });

  const controller = new PlaybackController(audio, battery, {
    onChange: (state) => {
      view.render(state, { showSimulator: forceSim || !battery.usingNative });
    }
  });

  window.__hush.controller = controller;

  battery.ready.then(() => {
    view.render(controller.getState(), {
      showSimulator: forceSim || !battery.usingNative
    });
  });

  view.render(controller.getState(), {
    showSimulator: forceSim || !battery.usingNative
  });
}

function numParam(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

boot();
