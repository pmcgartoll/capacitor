/**
 * DOM rendering for Hush. Pure view — no audio/battery logic.
 */

/**
 * @param {HTMLElement} root
 * @param {object} handlers
 * @param {() => void} handlers.onToggle
 * @param {(volume: number) => void} handlers.onVolume
 * @param {(level: number) => void} handlers.onSimLevel
 * @param {(charging: boolean) => void} handlers.onSimCharging
 */
export function mountView(root, handlers) {
  root.innerHTML = `
    <div class="atmosphere" aria-hidden="true">
      <div class="blob blob-a"></div>
      <div class="blob blob-b"></div>
    </div>
    <main class="shell">
      <header class="header">
        <p class="kicker">White noise</p>
        <h1 class="brand">HUSH</h1>
        <p class="lede">Keeps going — and backs off when your battery needs it.</p>
      </header>

      <section class="play-block">
        <button type="button" class="play-btn" id="playBtn" aria-label="Play white noise">
          <span class="play-ring"></span>
          <span class="play-icon" id="playIcon" data-state="paused"></span>
        </button>
        <p class="status" id="status" data-testid="status">Ready</p>
      </section>

      <section class="panel">
        <div class="row">
          <label for="volume">Volume</label>
          <span class="mono" id="volumeLabel" data-testid="effective-volume">55%</span>
        </div>
        <input id="volume" data-testid="volume" type="range" min="5" max="100" value="55" />
        <p class="hint warn hidden" id="saverHint" data-testid="saver-hint"></p>

        <hr class="rule" />

        <div class="battery-row">
          <span class="batt-icon" id="battIcon" data-level="full" data-charging="0" aria-hidden="true">
            <span class="batt-body"><span class="batt-fill" id="battFill"></span></span>
            <span class="batt-nub"></span>
          </span>
          <div>
            <p class="batt-title" data-testid="battery-label">Battery <span id="battPct">—</span></p>
            <p class="batt-detail" id="battDetail" data-testid="battery-detail">…</p>
          </div>
        </div>

        <div class="sim hidden" id="simPanel" data-testid="sim-panel">
          <p class="sim-label">Battery simulator <span class="pill">web / tests</span></p>
          <div class="row">
            <label for="simLevel">Level</label>
            <span class="mono" id="simLevelLabel">100%</span>
          </div>
          <input id="simLevel" data-testid="sim-level" type="range" min="0" max="100" value="100" />
          <label class="check">
            <input type="checkbox" id="simCharging" data-testid="sim-charging" />
            Charging
          </label>
        </div>
      </section>
    </main>
  `;

  const playBtn = root.querySelector('#playBtn');
  const volume = root.querySelector('#volume');
  const simLevel = root.querySelector('#simLevel');
  const simCharging = root.querySelector('#simCharging');

  playBtn.addEventListener('click', () => {
    playBtn.classList.add('pressed');
    window.setTimeout(() => playBtn.classList.remove('pressed'), 160);
    handlers.onToggle();
  });

  volume.addEventListener('input', () => {
    handlers.onVolume(Number(volume.value) / 100);
  });

  simLevel.addEventListener('input', () => {
    root.querySelector('#simLevelLabel').textContent = `${simLevel.value}%`;
    handlers.onSimLevel(Number(simLevel.value) / 100);
  });

  simCharging.addEventListener('change', () => {
    handlers.onSimCharging(simCharging.checked);
  });

  return {
    /**
     * @param {ReturnType<import('../core/playbackController.js').PlaybackController['getState']>} state
     * @param {{ showSimulator: boolean }} meta
     */
    render(state, meta) {
      const playIcon = root.querySelector('#playIcon');
      const status = root.querySelector('#status');
      const volumeLabel = root.querySelector('#volumeLabel');
      const saverHint = root.querySelector('#saverHint');
      const battPct = root.querySelector('#battPct');
      const battDetail = root.querySelector('#battDetail');
      const battIcon = root.querySelector('#battIcon');
      const battFill = root.querySelector('#battFill');
      const simPanel = root.querySelector('#simPanel');

      playBtn.setAttribute(
        'aria-label',
        state.isPlaying ? 'Pause white noise' : 'Play white noise'
      );
      playIcon.dataset.state = state.isPlaying ? 'playing' : 'paused';
      playBtn.classList.toggle('is-playing', state.isPlaying);

      status.textContent = state.statusMessage;
      volumeLabel.textContent = `${Math.round(state.effectiveVolume * 100)}%`;

      if (state.batteryMultiplier < 1) {
        saverHint.classList.remove('hidden');
        saverHint.textContent =
          `Battery saver active — output is ${Math.round(state.batteryMultiplier * 100)}% of your setting.`;
      } else {
        saverHint.classList.add('hidden');
        saverHint.textContent = '';
      }

      battPct.textContent = state.batteryPercent;
      battDetail.textContent = state.batteryDetail;
      const level = state.battery.level;
      battFill.style.transform = `scaleX(${Math.max(0.06, level)})`;
      battIcon.dataset.charging = state.battery.charging ? '1' : '0';
      battIcon.dataset.level =
        level < 0.2 ? 'low' : level < 0.45 ? 'mid' : 'full';

      if (meta.showSimulator) {
        simPanel.classList.remove('hidden');
      } else {
        simPanel.classList.add('hidden');
      }
    }
  };
}
