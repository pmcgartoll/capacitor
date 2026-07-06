/**
 * Kismet — renderer, input, juice (uses KismetEngine for all logic).
 */
(function () {
  'use strict';

  const E = window.KismetEngine;
  const PREVIEW_HOLD_MS = 400;
  const DIE_HOLD_MS = 350;

  let state = E.createInitialState(42);
  let selectedDieId = null;
  let activeTool = null;
  let rolling = false;
  let previewHoldTimer = null;
  let dieHoldTimer = null;
  let dragState = null;
  let particles = [];
  let animFrame = null;
  let lastBudget = E.MANIP_BUDGET;

  const $ = (sel) => document.querySelector(sel);
  const playSurface = $('#play-surface');
  const board = $('#board');
  const diceTray = $('#dice-tray');
  const particlesCanvas = $('#particles');
  const pCtx = particlesCanvas.getContext('2d');

  function vibrate(ms) {
    try { navigator.vibrate?.(ms); } catch (_) { /* noop */ }
  }

  function setState(next) {
    const budgetDropped = next.manipulationBudget < state.manipulationBudget;
    state = next;
    if (budgetDropped) snapPip();
    render();
    return state;
  }

  function snapPip() {
    const pips = document.querySelectorAll('.pip:not(.spent)');
    const last = pips[pips.length - 1];
    if (last) {
      last.classList.add('spent', 'snap');
      setTimeout(() => last.classList.remove('snap'), 300);
    }
    vibrate(12);
  }

  // ── Particles ────────────────────────────────────────────────────────────

  function resizeCanvas() {
    const rect = $('#app').getBoundingClientRect();
    particlesCanvas.width = rect.width;
    particlesCanvas.height = rect.height;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        color,
        size: 3 + Math.random() * 4,
      });
    }
    if (!animFrame) tickParticles();
  }

  function tickParticles() {
    pCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    particles = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.025;
      if (p.life <= 0) return false;
      pCtx.globalAlpha = p.life;
      pCtx.fillStyle = p.color;
      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      pCtx.fill();
      return true;
    });
    pCtx.globalAlpha = 1;
    animFrame = particles.length ? requestAnimationFrame(tickParticles) : null;
  }

  function floatNumber(x, y, text, cls) {
    const el = document.createElement('div');
    el.className = `float-num ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $('#app').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function screenJuice(kind) {
    playSurface.classList.remove('shake', 'warp');
    void playSurface.offsetWidth;
    playSurface.classList.add(kind);
    setTimeout(() => playSurface.classList.remove(kind), 500);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  function render() {
    $('#hp-val').textContent = state.player.hp;
    $('#block-val').textContent = state.player.block;
    $('#turn-val').textContent = `Turn ${state.turn}`;
    $('#message-bar').textContent = state.message;

    renderEnemy();
    renderPips();
    renderDice();
    renderTargetLines();
    renderButtons();
    renderPreview(false);
  }

  function renderEnemy() {
    const e = state.enemy;
    const pct = Math.max(0, (e.hp / e.maxHp) * 100);
    $('#enemy-hp').textContent = e.hp;
    $('#enemy-hp-fill').style.width = `${pct}%`;
    $('#enemy-name').textContent = e.name;
    const intent = e.intent;
    $('#intent-text').textContent = `attacks for ${intent.value}`;
    $('#intent-value').textContent = intent.value;
  }

  function renderPips() {
    const bar = $('#pip-bar');
    bar.innerHTML = '';
    for (let i = 0; i < state.maxManipulationBudget; i++) {
      const pip = document.createElement('div');
      pip.className = 'pip' + (i >= state.manipulationBudget ? ' spent' : '');
      bar.appendChild(pip);
    }
    lastBudget = state.manipulationBudget;

    const canManip = state.phase === 'manipulate' && state.manipulationBudget > 0;
    $('#tool-reroll').disabled = !canManip;
    $('#tool-nudge-up').disabled = !canManip;
    $('#tool-nudge-down').disabled = !canManip;
    $('#tool-lock').disabled = !canManip || !selectedDieId;

    ['tool-reroll', 'tool-nudge-up', 'tool-nudge-down', 'tool-lock'].forEach((id) => {
      $(`#${id}`).classList.toggle('active', activeTool === id.replace('tool-', ''));
    });
  }

  function faceHtml(face, color) {
    const val = face.value > 0 ? face.value : '';
    return `<div class="die-face" style="background:linear-gradient(145deg,${color},${shade(color,-30)})">
      <span class="face-icon">${face.icon}</span>
      ${val ? `<span class="face-val">${val}</span>` : ''}
    </div>`;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  function renderDice() {
    diceTray.innerHTML = '';
    state.dice.forEach((die) => {
      const el = document.createElement('div');
      el.className = 'die';
      el.dataset.dieId = die.id;
      if (die.locked) el.classList.add('locked');
      if (die.id === selectedDieId) el.classList.add('selected');
      if (die.assignment === 'enemy') el.classList.add('assigned-enemy');
      if (die.assignment === 'self') el.classList.add('assigned-self');

      const face = E.getFace(die);
      el.innerHTML = `<div class="die-inner">${faceHtml(face, die.color)}</div>`;
      diceTray.appendChild(el);
    });
  }

  function getDieCenter(dieId) {
    const el = diceTray.querySelector(`[data-die-id="${dieId}"]`);
    if (!el) return null;
    const appRect = $('#app').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - appRect.left, y: r.top + r.height / 2 - appRect.top };
  }

  function getTargetCenter(target) {
    const appRect = $('#app').getBoundingClientRect();
    const sel = target === 'enemy' ? '#enemy-target .enemy-card' : '#self-slot';
    const el = $(sel);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - appRect.left, y: r.top + r.height / 2 - appRect.top };
  }

  function renderTargetLines() {
    const svg = $('#target-lines');
    svg.innerHTML = '';
    if (state.phase !== 'manipulate') return;

    state.dice.forEach((die) => {
      if (!die.assignment) return;
      const from = getDieCenter(die.id);
      const to = getTargetCenter(die.assignment);
      if (!from || !to) return;

      const face = E.getFace(die);
      let label = '';
      if (die.assignment === 'enemy' && face.type === 'attack') label = `-${face.value}`;
      else if (die.assignment === 'self' && face.type === 'block') label = `+${face.value}`;
      else if (face.type === 'spark') label = '⚡+2';
      else if (face.type === 'mana') label = `+${face.value}◆`;
      else label = face.icon;

      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      svg.appendChild(line);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', mx);
      text.setAttribute('y', my - 6);
      text.textContent = label;
      svg.appendChild(text);
    });
  }

  function renderButtons() {
    const rollBtn = $('#roll-btn');
    const resolveBtn = $('#resolve-btn');
    rollBtn.style.display = state.phase === 'await_roll' ? 'block' : 'none';
    resolveBtn.style.display = state.phase === 'manipulate' ? 'block' : 'none';
    rollBtn.disabled = rolling;
    resolveBtn.disabled = rolling;
  }

  function renderPreview(show) {
    const panel = $('#preview-panel');
    if (!show || state.phase !== 'manipulate') {
      panel.classList.remove('visible');
      return;
    }
    const p = E.previewResolve(state);
    $('#pv-attack').textContent = p.attackDealt > 0 ? `-${p.attackDealt}` : '0';
    $('#pv-block').textContent = p.blockGained > 0 ? `+${p.blockGained}` : '0';
    $('#pv-enemy-hp').textContent = p.enemyHp;
    $('#pv-player-hp').textContent = p.playerHp;
    $('#pv-incoming').textContent = p.incomingDamage;
    $('#pv-after-block').textContent = p.damageAfterBlock;
    panel.classList.add('visible');
  }

  // ── Roll animation (cosmetic over predetermined results) ─────────────────

  function doRoll() {
    if (state.phase !== 'await_roll' || rolling) return;
    rolling = true;
    vibrate([15, 30, 20]);

    const prevFaces = Object.fromEntries(state.dice.map((d) => [d.id, d.faceIndex]));
    const next = E.rollDice(state);
    setState(next);

    const diceEls = diceTray.querySelectorAll('.die');
    diceEls.forEach((el, i) => {
      const dieId = el.dataset.dieId;
      const die = state.dice.find((d) => d.id === dieId);
      if (die && !die.locked && prevFaces[dieId] !== die.faceIndex) {
        el.classList.add('rolling');
        setTimeout(() => {
          el.classList.remove('rolling');
          const die = state.dice.find((d) => d.id === el.dataset.dieId);
          if (die) {
            const face = E.getFace(die);
            const inner = el.querySelector('.die-inner');
            inner.innerHTML = faceHtml(face, die.color);
          }
        }, 650 + i * 80);
      }
    });

    const boardRect = board.getBoundingClientRect();
    const appRect = $('#app').getBoundingClientRect();
    burst(
      boardRect.left + boardRect.width / 2 - appRect.left,
      boardRect.top + boardRect.height / 2 - appRect.top,
      '#f0d080',
      20
    );

    setTimeout(() => {
      rolling = false;
      renderButtons();
    }, 800);
  }

  // ── Resolve flow ─────────────────────────────────────────────────────────

  function commitResolve() {
    if (state.phase !== 'manipulate') return;
    const preview = E.previewResolve(state);
    const next = E.resolveTurn(state);
    setState(next);

    const enemyEl = $('#enemy-target .enemy-card');
    const appRect = $('#app').getBoundingClientRect();
    const enemyRect = enemyEl.getBoundingClientRect();

    if (preview.attackDealt > 0) {
      enemyEl.classList.add('hit');
      setTimeout(() => enemyEl.classList.remove('hit'), 400);
      floatNumber(
        enemyRect.left + enemyRect.width / 2 - appRect.left,
        enemyRect.top - appRect.top,
        `-${preview.attackDealt}`,
        'damage'
      );
      burst(
        enemyRect.left + enemyRect.width / 2 - appRect.left,
        enemyRect.top + enemyRect.height / 2 - appRect.top,
        '#ff8060',
        preview.attackDealt >= 10 ? 30 : 15
      );
    }

    if (preview.blockGained > 0) {
      const selfRect = $('#self-slot').getBoundingClientRect();
      floatNumber(
        selfRect.left + selfRect.width / 2 - appRect.left,
        selfRect.top - appRect.top,
        `+${preview.blockGained}`,
        'block'
      );
    }

    if (preview.attackDealt >= 12) screenJuice('warp');
    else if (preview.attackDealt >= 8) screenJuice('shake');

    vibrate([20, 40, 20]);

    if (next.phase === 'victory') {
      setTimeout(showVictory, 600);
    } else if (next.phase === 'enemy_act') {
      setTimeout(doEnemyAct, 800);
    }
  }

  function doEnemyAct() {
    const before = state.player.hp;
    const preview = state.outcome;
    const next = E.enemyAct(state);
    setState(next);

    if (preview && preview.enemyDamageDealt > 0) {
      const appRect = $('#app').getBoundingClientRect();
      const headerRect = $('#header').getBoundingClientRect();
      floatNumber(
        headerRect.left + 40 - appRect.left,
        headerRect.bottom - appRect.top,
        `-${preview.enemyDamageDealt}`,
        'damage'
      );
      vibrate(30);
    }

    if (next.phase === 'defeat') {
      setTimeout(showDefeat, 500);
    }
  }

  function showVictory() {
    const overlay = $('#overlay');
    overlay.innerHTML = `
      <div class="overlay-card">
        <h2>Victory!</h2>
        <p>The Stone Golem crumbles. Fate bent to your will.</p>
        <button class="overlay-btn" id="btn-reward">Craft a Face</button>
        <button class="overlay-btn" id="btn-restart" style="background:linear-gradient(145deg,#5a5a5a,#3a3a3a);color:#f5ebe0">Skip & Restart</button>
      </div>`;
    overlay.classList.add('visible');
    $('#btn-reward').addEventListener('click', () => {
      overlay.classList.remove('visible');
      setState(E.beginReward(state));
      showRewardUI();
    });
    $('#btn-restart').addEventListener('click', resetGame);
  }

  function showDefeat() {
    const overlay = $('#overlay');
    overlay.innerHTML = `
      <div class="overlay-card">
        <h2>Defeat</h2>
        <p>The golem's intent was too sharp. Try bending fate again.</p>
        <button class="overlay-btn" id="btn-restart">Try Again</button>
      </div>`;
    overlay.classList.add('visible');
    $('#btn-restart').addEventListener('click', resetGame);
  }

  let rewardFaceIdx = 0;

  function showRewardUI() {
    const pr = state.pendingReward;
    if (!pr) return;
    const overlay = $('#overlay');
    overlay.innerHTML = `
      <div class="overlay-card">
        <h2>Face Crafting</h2>
        <p>Add a new face to one of your dice — deckbuilding on dice.</p>
        <div class="reward-dice-pick" id="reward-dice-pick"></div>
        <div class="reward-choices" id="reward-choices"></div>
        <button class="overlay-btn" id="btn-apply-reward">Apply Face</button>
      </div>`;
    overlay.classList.add('visible');

    const dicePick = $('#reward-dice-pick');
    state.dice.forEach((d) => {
      const btn = document.createElement('button');
      btn.className = 'reward-die-btn' + (d.id === pr.targetDieId ? ' selected' : '');
      btn.textContent = d.name;
      btn.addEventListener('click', () => {
        setState(E.setRewardTargetDie(state, d.id));
        dicePick.querySelectorAll('.reward-die-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      dicePick.appendChild(btn);
    });

    const choices = $('#reward-choices');
    pr.choices.forEach((f, i) => {
      const btn = document.createElement('button');
      btn.className = 'reward-face-btn' + (i === rewardFaceIdx ? ' selected' : '');
      btn.innerHTML = `<span>${f.icon}</span><span style="font-size:12px;font-weight:700">${f.value || ''}</span>`;
      btn.addEventListener('click', () => {
        rewardFaceIdx = i;
        choices.querySelectorAll('.reward-face-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      choices.appendChild(btn);
    });

    $('#btn-apply-reward').addEventListener('click', () => {
      overlay.classList.remove('visible');
      setState(E.applyReward(state, rewardFaceIdx));
      setTimeout(resetGame, 1200);
    });
  }

  function resetGame() {
    $('#overlay').classList.remove('visible');
    selectedDieId = null;
    activeTool = null;
    rewardFaceIdx = 0;
    setState(E.resetBattle(Date.now() >>> 0));
  }

  // ── Die tooltip (hold to read) ─────────────────────────────────────────────

  function showDieTooltip(dieId, x, y) {
    const die = state.dice.find((d) => d.id === dieId);
    if (!die) return;
    const tip = $('#die-tooltip');
    const face = E.getFace(die);
    let chips = '';
    die.faces.forEach((f, i) => {
      chips += `<div class="face-chip${i === die.faceIndex ? ' current' : ''}">
        <div class="chip-icon">${f.icon}</div>
        <div class="chip-val">${f.value || ''}</div>
      </div>`;
    });
    tip.innerHTML = `<h4>${die.name}</h4><div class="faces-grid">${chips}</div>
      <p class="reminder">${face.reminder}</p>`;
    tip.style.left = `${Math.min(x, 180)}px`;
    tip.style.top = `${Math.max(y - 120, 60)}px`;
    tip.classList.add('visible');
  }

  function hideDieTooltip() {
    $('#die-tooltip').classList.remove('visible');
  }

  // ── Pointer input ────────────────────────────────────────────────────────

  function pickDie(el) {
    return el?.closest?.('.die')?.dataset?.dieId || null;
  }

  function handleDieTap(dieId) {
    if (state.phase !== 'manipulate' || rolling) return;
    selectedDieId = selectedDieId === dieId ? null : dieId;
    renderDice();
    renderPips();
  }

  function applyTool(tool) {
    if (!selectedDieId || state.manipulationBudget <= 0) return;
    let next = state;
    if (tool === 'reroll') next = E.rerollDie(state, selectedDieId);
    else if (tool === 'nudge-up') next = E.nudgeDie(state, selectedDieId, 1);
    else if (tool === 'nudge-down') next = E.nudgeDie(state, selectedDieId, -1);
    else if (tool === 'lock') {
      next = E.lockDie(state, selectedDieId);
      vibrate([10, 25]);
    }
    if (next !== state) {
      setState(next);
      const el = diceTray.querySelector(`[data-die-id="${selectedDieId}"]`);
      if (el) {
        el.classList.add('snap');
        setTimeout(() => el.classList.remove('snap'), 250);
      }
    }
  }

  function assignToTarget(dieId, target) {
    if (state.phase !== 'manipulate') return;
    const die = state.dice.find((d) => d.id === dieId);
    if (!die) return;
    if (die.assignment === target) {
      setState(E.assignDie(state, dieId, target));
      return;
    }
    const face = E.getFace(die);
    if (target === 'enemy' && face.type !== 'attack' && face.type !== 'spark') return;
    if (target === 'self' && face.type !== 'block' && face.type !== 'mana') return;
    setState(E.assignDie(state, dieId, target));
  }

  // Drag dice to targets
  function onPointerDown(e) {
    if (e.target.closest('#resolve-btn, #roll-btn, .tool-btn, #reset-btn')) return;
    const dieId = pickDie(e.target);
    if (dieId && state.phase === 'manipulate') {
      dragState = {
        dieId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        pointerId: e.pointerId,
      };
      dieHoldTimer = setTimeout(() => {
        if (dragState && !dragState.moved) {
          const appRect = $('#app').getBoundingClientRect();
          showDieTooltip(dieId, e.clientX - appRect.left, e.clientY - appRect.top);
        }
      }, DIE_HOLD_MS);
      e.target.closest('.die')?.setPointerCapture?.(e.pointerId);
    }
  }

  function onPointerMove(e) {
    if (!dragState || dragState.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    if (Math.abs(dx) + Math.abs(dy) > 8) {
      dragState.moved = true;
      clearTimeout(dieHoldTimer);
      hideDieTooltip();
    }
    $('#enemy-target').classList.toggle('highlight', isOver(e, '#enemy-target'));
    $('#self-slot').classList.toggle('highlight', isOver(e, '#self-slot'));
  }

  function isOver(e, sel) {
    const el = $(sel);
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function onPointerUp(e) {
    clearTimeout(dieHoldTimer);
    hideDieTooltip();
    $('#enemy-target').classList.remove('highlight');
    $('#self-slot').classList.remove('highlight');

    if (!dragState || dragState.pointerId !== e.pointerId) return;

    if (!dragState.moved) {
      handleDieTap(dragState.dieId);
    } else if (isOver(e, '#enemy-target')) {
      assignToTarget(dragState.dieId, 'enemy');
    } else if (isOver(e, '#self-slot')) {
      assignToTarget(dragState.dieId, 'self');
    }
    dragState = null;
  }

  // Hold-to-preview on resolve
  function onResolveDown(e) {
    e.preventDefault();
    $('#resolve-btn').classList.add('holding');
    previewHoldTimer = setTimeout(() => {
      renderPreview(true);
      vibrate(8);
    }, PREVIEW_HOLD_MS);
  }

  function onResolveUp(e) {
    clearTimeout(previewHoldTimer);
    const wasPreview = $('#preview-panel').classList.contains('visible');
    $('#resolve-btn').classList.remove('holding');
    renderPreview(false);
    if (wasPreview) commitResolve();
  }

  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // ── Init ─────────────────────────────────────────────────────────────────

  function bindEvents() {
    $('#roll-btn').addEventListener('click', doRoll);
    $('#reset-btn').addEventListener('click', resetGame);

    const resolveBtn = $('#resolve-btn');
    resolveBtn.addEventListener('pointerdown', onResolveDown);
    resolveBtn.addEventListener('pointerup', onResolveUp);
    resolveBtn.addEventListener('pointerleave', () => {
      clearTimeout(previewHoldTimer);
      resolveBtn.classList.remove('holding');
      renderPreview(false);
    });
    resolveBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    $('#tool-reroll').addEventListener('click', () => applyTool('reroll'));
    $('#tool-nudge-up').addEventListener('click', () => applyTool('nudge-up'));
    $('#tool-nudge-down').addEventListener('click', () => applyTool('nudge-down'));
    $('#tool-lock').addEventListener('click', () => applyTool('lock'));

    diceTray.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    window.addEventListener('resize', () => {
      resizeCanvas();
      renderTargetLines();
    });
  }

  function init() {
    resizeCanvas();
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
