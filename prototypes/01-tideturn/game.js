/**
 * Tideturn — rendering, input, juice (uses TideturnEngine for all logic).
 */
(function () {
  'use strict';

  const E = window.TideturnEngine;
  const CARD_ICONS = {
    strike: '〰',
    cleave: '☍',
    guard: '⬡',
    twin_strike: '✦',
    undertow: '↯',
    push: '⇆',
    surge: '⚡',
    tsunami: '🌊',
  };

  const HOLD_MS = 400;
  const DRAG_THRESHOLD = 10;

  let state = null;
  let staged = [];
  let preview = null;
  let rng = null;
  let resolving = false;

  // Pointer state
  let activePointer = null;
  let dragCardUid = null;
  let dragStart = null;
  let holdTimer = null;
  let holdTriggered = false;
  let ghostEl = null;

  // DOM refs
  let app, playSurface, boardEl, handEl, stagedRow, incomingEl, commitBtn;
  let overlay, particlesCanvas, ctx;
  let particles = [];

  function init() {
    app = document.getElementById('app');
    playSurface = document.getElementById('play-surface');
    boardEl = document.getElementById('board');
    handEl = document.getElementById('hand');
    stagedRow = document.getElementById('staged-row');
    incomingEl = document.getElementById('incoming-readout');
    commitBtn = document.getElementById('commit-btn');
    overlay = document.getElementById('overlay');
    particlesCanvas = document.getElementById('particles');
    ctx = particlesCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    document.getElementById('reset-btn').addEventListener('click', resetBattle);
    document.getElementById('overlay-restart').addEventListener('click', resetBattle);
    commitBtn.addEventListener('click', onCommit);

    document.getElementById('glossary-close').addEventListener('click', () => {
      document.getElementById('glossary-popup').classList.remove('visible');
    });

    playSurface.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });

    // Prevent double-tap zoom
    let lastTap = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 300) e.preventDefault();
      lastTap = now;
    }, { passive: false });

    resetBattle();
    requestAnimationFrame(particleLoop);
  }

  function resizeCanvas() {
    const rect = app.getBoundingClientRect();
    particlesCanvas.width = rect.width;
    particlesCanvas.height = rect.height;
  }

  function resetBattle() {
    const seed = Date.now() & 0xfffffff;
    state = E.createInitialState(seed);
    rng = E.createRng(seed);
    staged = [];
    preview = null;
    resolving = false;
    overlay.classList.remove('visible', 'victory', 'defeat');
    state.phase = 'plan';
    refresh();
  }

  function refresh() {
    if (!preview && staged.length > 0) {
      preview = E.computePreview(state, staged);
    } else if (staged.length === 0) {
      preview = null;
    } else {
      preview = E.computePreview(state, staged);
    }
    renderHeader();
    renderBoard();
    renderHand();
    renderStaged();
    renderIncoming();
    renderCommit();
  }

  function renderHeader() {
    const p = preview ? preview.projectedPlayer : state.player;
    document.getElementById('hp-val').textContent = p.hp;
    document.getElementById('block-val').textContent = p.block;
    const energyLeft = preview
      ? preview.energyRemaining
      : state.player.energy - E.getStagedEnergyCost(staged, state.hand);
    document.getElementById('energy-val').textContent = energyLeft;
    document.getElementById('turn-val').textContent = 'Turn ' + state.turn;

    const blockGhost = document.getElementById('block-ghost');
    if (preview && preview.projectedPlayer.block > state.player.block) {
      blockGhost.textContent = '+' + (preview.projectedPlayer.block - state.player.block) + ' Block';
      blockGhost.classList.add('visible');
    } else {
      blockGhost.classList.remove('visible');
    }
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    for (let lane = 0; lane < 3; lane++) {
      const laneEl = document.createElement('div');
      laneEl.className = 'lane';
      laneEl.dataset.lane = lane;
      laneEl.innerHTML = '<div class="lane-label">Lane ' + (lane + 1) + '</div>';

      const enemies = state.enemies.filter((e) => e.lane === lane);
      for (const enemy of enemies) {
        laneEl.appendChild(createEnemyEl(enemy));
      }
      boardEl.appendChild(laneEl);
    }

    const pz = document.createElement('div');
    pz.id = 'player-zone';
    pz.textContent = 'You';
    boardEl.appendChild(pz);
  }

  function createEnemyEl(enemy) {
    const proj = preview
      ? preview.projectedEnemies.find((e) => e.id === enemy.id)
      : null;
    const curHp = enemy.hp;
    const futHp = proj ? proj.hp : curHp;
    const isDead = futHp <= 0 && curHp > 0;
    const tookDamage = futHp < curHp;

    const el = document.createElement('div');
    el.className = 'enemy' + (isDead ? ' ghost-dead' : '');
    el.dataset.enemyId = enemy.id;

    const hpPct = Math.max(0, (futHp / enemy.maxHp) * 100);
    const hpClass = tookDamage ? 'ghost-damage' : (futHp > curHp ? 'ghost-safe' : '');

    let html = '';
    html += '<div class="order-pip">' + enemy.turnOrder + '</div>';
    if (enemy.block > 0) {
      html += '<div class="enemy-block-badge">' + enemy.block + '</div>';
    }
    if ((enemy.attackReduction || 0) > 0) {
      html += '<div class="debuff-badge">−' + enemy.attackReduction + ' atk</div>';
    }
    html += '<div class="enemy-name">' + enemy.name + '</div>';
    html += '<div class="enemy-hp-bar"><div class="enemy-hp-fill ' + hpClass + '" style="width:' + hpPct + '%"></div></div>';
    html += '<div class="enemy-hp-text ' + hpClass + '">' + futHp + '/' + enemy.maxHp + '</div>';

    if (enemy.hp > 0 && enemy.intent) {
      html += renderIntent(enemy);
    }
    el.innerHTML = html;
    return el;
  }

  function renderIntent(enemy) {
    const intent = enemy.intent;
    const info = E.INTENT_TYPES[intent.type] || { icon: '?', label: '?' };
    let targetLabel = 'You';
    if (intent.type === 'defend') targetLabel = 'Self';
    else if (intent.type === 'charge') targetLabel = 'Charging';
    else if (intent.targetLane !== null && intent.targetLane !== undefined) {
      targetLabel = 'Lane ' + (intent.targetLane + 1);
    }

    const arrowClass = intent.type === 'attack_player' ? 'to-player' : 'to-lane';
    const valueText = intent.type === 'attack_player' ? intent.value
      : intent.type === 'defend' ? '+' + intent.value
      : '+' + intent.value;

    return '<div class="intent">' +
      '<div class="intent-row"><span class="intent-icon">' + info.icon + '</span>' +
      '<span class="intent-value">' + valueText + '</span></div>' +
      '<div class="intent-arrow ' + arrowClass + '"></div>' +
      '<div class="intent-target">→ ' + targetLabel + '</div></div>';
  }

  function renderHand() {
    handEl.innerHTML = '';
    const cards = state.hand;
    const count = cards.length;
    const stagedUids = new Set(staged.map((s) => s.cardUid));
    const stagedCost = E.getStagedEnergyCost(staged, state.hand);
    const energyLeft = state.player.energy - stagedCost;

    cards.forEach((inst, i) => {
      const card = E.CARDS[inst.cardId];
      if (!card) return;
      const isStaged = stagedUids.has(inst.uid);
      const canAfford = card.cost <= energyLeft || isStaged;

      const el = document.createElement('div');
      el.className = 'card' + (isStaged ? ' staged-hidden' : '') + (!canAfford && !isStaged ? ' unaffordable' : '');
      el.dataset.cardUid = inst.uid;

      const spread = Math.min(count - 1, 4);
      const offset = i - (count - 1) / 2;
      const angle = offset * 6;
      const xOff = offset * 56;
      const yOff = Math.abs(offset) * 4;
      el.style.left = 'calc(50% + ' + xOff + 'px - 36px)';
      el.style.bottom = yOff + 'px';
      el.style.transform = 'rotate(' + angle + 'deg)';
      el.style.zIndex = i;

      el.innerHTML =
        '<div class="card-cost">' + card.cost + '</div>' +
        '<div class="card-name">' + card.name + '</div>' +
        '<div class="card-icon">' + (CARD_ICONS[inst.cardId] || '◆') + '</div>' +
        '<div class="card-keywords">' +
        card.keywords.map((k) => '<span class="keyword" data-kw="' + k + '">' + k + '</span>').join('') +
        '</div>';

      handEl.appendChild(el);
    });
  }

  function renderStaged() {
    stagedRow.innerHTML = '';
    if (staged.length === 0) return;
    for (const action of staged) {
      const inst = state.hand.find((c) => c.uid === action.cardUid);
      if (!inst) continue;
      const card = E.CARDS[inst.cardId];
      const chip = document.createElement('div');
      chip.className = 'staged-chip';
      chip.dataset.cardUid = action.cardUid;
      let label = card.name;
      if (action.target && action.target.enemyId) {
        const en = E.getEnemy(state, action.target.enemyId);
        if (en) label += ' → ' + en.name.split(' ')[0];
      } else if (action.target && action.target.lane !== undefined) {
        label += ' → L' + (action.target.lane + 1);
      }
      chip.innerHTML = '<span class="cost">' + card.cost + '</span>' + label + ' ✕';
      chip.addEventListener('click', () => unstageCard(action.cardUid));
      stagedRow.appendChild(chip);
    }
  }

  function renderIncoming() {
    const baseInc = E.calculateIncomingDamage(state);
    const projInc = preview ? preview.incomingDamage : baseInc.total;
    const blockAfter = preview ? preview.projectedPlayer.block : state.player.block;

    if (projInc > 0) {
      let text = "You'll take " + projInc + " damage next turn";
      if (blockAfter > 0) text += ' (' + blockAfter + ' block absorbs some)';
      incomingEl.textContent = text;
      incomingEl.classList.add('danger');
    } else if (baseInc.total > 0 && blockAfter >= baseInc.total) {
      incomingEl.textContent = 'Block will absorb all incoming damage';
      incomingEl.classList.remove('danger');
    } else {
      incomingEl.textContent = staged.length > 0 ? 'No incoming damage after your turn' : 'Survey the tide…';
      incomingEl.classList.remove('danger');
    }
  }

  function renderCommit() {
    const canCommit = staged.length > 0 && !resolving && state.phase === 'plan';
    commitBtn.disabled = !canCommit;
    commitBtn.classList.toggle('glow', canCommit);
    commitBtn.textContent = staged.length > 0
      ? 'Commit (' + staged.length + ' card' + (staged.length > 1 ? 's' : '') + ')'
      : 'Commit Turn';
  }

  // ── Staging ──────────────────────────────────────────────────────────────

  function stageCard(cardUid, target) {
    if (!E.canStageCard(state, cardUid, staged)) return false;
    staged.push({ cardUid, target });
    preview = E.computePreview(state, staged);
    refresh();
    vibrate(8);
    return true;
  }

  function unstageCard(cardUid) {
    staged = staged.filter((s) => s.cardUid !== cardUid);
    preview = staged.length > 0 ? E.computePreview(state, staged) : null;
    refresh();
    vibrate(5);
  }

  // ── Commit & resolve ─────────────────────────────────────────────────────

  async function onCommit() {
    if (resolving || staged.length === 0 || state.phase !== 'plan') return;
    resolving = true;
    commitBtn.disabled = true;
    vibrate(20);

    app.classList.add('hit-stop');
    setTimeout(() => app.classList.remove('hit-stop'), 120);

    const actions = staged.slice();
    const events = E.resolveStagedTurn(state, actions, rng);

    // Animate player card effects
    for (const ev of events) {
      if (ev.type === 'damage' && ev.amount > 0) {
        const enemyEl = document.querySelector('[data-enemy-id="' + ev.enemyId + '"]');
        if (enemyEl) {
          enemyEl.classList.add('resolving-hit');
          spawnInkSplash(enemyEl);
          showDamagePop(enemyEl, '−' + ev.amount);
          app.classList.add('hit-stop');
          setTimeout(() => {
            enemyEl.classList.remove('resolving-hit');
            app.classList.remove('hit-stop');
          }, 120);
        }
        vibrate(12);
        await delay(180);
      } else if (ev.type === 'block') {
        showDamagePop(document.getElementById('block-val'), '+' + ev.amount, true);
        await delay(120);
      }
    }

    staged = [];
    preview = null;
    refresh();

    if (events.filter((e) => e.type === 'damage').length >= 3) {
      app.classList.add('wave', 'shake');
      setTimeout(() => app.classList.remove('wave', 'shake'), 500);
    }

    await delay(200);

    // Enemy phase
    state.phase = 'enemy';
    const enemyEvents = E.resolveEnemyPhase(state);
    refresh();

    for (const ev of enemyEvents) {
      if (ev.type === 'player_damage' && ev.amount > 0) {
        showDamagePop(document.getElementById('hp-val'), '−' + ev.amount);
        app.classList.add('shake');
        setTimeout(() => app.classList.remove('shake'), 350);
        vibrate(25);
        await delay(250);
      } else if (ev.type === 'block_absorb') {
        showDamagePop(document.getElementById('block-val'), '−' + ev.amount);
        await delay(150);
      } else if (ev.type === 'enemy_attack') {
        const enemyEl = document.querySelector('[data-enemy-id="' + ev.enemyId + '"]');
        if (enemyEl) spawnInkSplash(enemyEl, true);
        await delay(200);
      }
    }

    refresh();

    if (E.checkDefeat(state)) {
      showOverlay('defeat', 'Defeated');
      resolving = false;
      return;
    }
    if (E.checkVictory(state)) {
      showOverlay('victory', 'Victory');
      resolving = false;
      return;
    }

    E.startNewTurn(state, rng);
    resolving = false;
    refresh();
  }

  function showOverlay(type, title) {
    overlay.className = 'visible ' + type;
    document.getElementById('overlay-title').textContent = title;
    const sub = type === 'victory'
      ? 'The tide recedes… for now.'
      : 'The sea claims another tide-caller.';
    document.getElementById('overlay-sub').textContent = sub;
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Pointer / drag / hold ────────────────────────────────────────────────

  function onPointerDown(e) {
    if (resolving) return;
    const card = e.target.closest('.card');
    const keyword = e.target.closest('.keyword');
    if (keyword && !card) {
      e.preventDefault();
      showGlossary(keyword.dataset.kw);
      return;
    }
    if (!card || card.classList.contains('staged-hidden')) return;

    e.preventDefault();
    activePointer = e.pointerId;
    dragCardUid = parseInt(card.dataset.cardUid, 10);
    dragStart = { x: e.clientX, y: e.clientY };
    holdTriggered = false;

    holdTimer = setTimeout(() => {
      if (dragCardUid && !ghostEl) {
        holdTriggered = true;
        showCardTooltip(dragCardUid, e.clientX, e.clientY);
        vibrate(10);
      }
    }, HOLD_MS);
  }

  function onPointerMove(e) {
    if (e.pointerId !== activePointer || !dragCardUid) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // !ghostEl guard: without it every pointermove past the threshold spawns
    // (and leaks) another ghost card, leaving a trail of stacked copies.
    if (!holdTriggered && !ghostEl && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      clearTimeout(holdTimer);
      hideCardTooltip();
      startDrag(e);
    }

    if (ghostEl) {
      ghostEl.style.transform = ghostTransform(e.clientX, e.clientY);
      updateDropHighlights(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointer) return;
    clearTimeout(holdTimer);
    hideCardTooltip();

    if (ghostEl) {
      const target = getDropTarget(e.clientX, e.clientY);
      if (target) stageCard(dragCardUid, target);
      endDrag();
    }

    activePointer = null;
    dragCardUid = null;
    dragStart = null;
    holdTriggered = false;
    clearDropHighlights();
  }

  // Move the drag ghost via transform only: mutating left/top per pointer move
  // forces layout + repaint each frame; transforms stay on the compositor.
  function ghostTransform(x, y) {
    return 'translate3d(' + x + 'px, ' + y + 'px, 0) translate(-50%, -50%)';
  }

  function startDrag(e) {
    const cardEl = document.querySelector('[data-card-uid="' + dragCardUid + '"]');
    if (!cardEl) return;
    cardEl.classList.add('dragging');

    const inst = state.hand.find((c) => c.uid === dragCardUid);
    const card = inst ? E.CARDS[inst.cardId] : null;
    if (!card) return;

    ghostEl = document.createElement('div');
    ghostEl.className = 'card dragging';
    ghostEl.style.position = 'fixed';
    ghostEl.style.width = '72px';
    ghostEl.style.height = '100px';
    ghostEl.style.left = '0';
    ghostEl.style.top = '0';
    ghostEl.style.willChange = 'transform';
    ghostEl.style.transform = ghostTransform(e.clientX, e.clientY);
    ghostEl.style.pointerEvents = 'none';
    ghostEl.innerHTML =
      '<div class="card-cost">' + card.cost + '</div>' +
      '<div class="card-name">' + card.name + '</div>' +
      '<div class="card-icon">' + (CARD_ICONS[inst.cardId] || '◆') + '</div>';
    document.body.appendChild(ghostEl);
  }

  function endDrag() {
    const cardEl = document.querySelector('.card.dragging');
    if (cardEl) cardEl.classList.remove('dragging');
    if (ghostEl) {
      ghostEl.remove();
      ghostEl = null;
    }
  }

  function getDropTarget(x, y) {
    const inst = state.hand.find((c) => c.uid === dragCardUid);
    if (!inst) return null;
    const card = E.CARDS[inst.cardId];
    if (!card) return null;

    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    if (!card.needsTarget) {
      const pz = el.closest('#player-zone');
      const board = el.closest('#board');
      if (pz || board) return {};
      return null;
    }

    if (card.needsTarget === 'enemy') {
      const enemyEl = el.closest('.enemy');
      if (enemyEl) {
        const id = parseInt(enemyEl.dataset.enemyId, 10);
        const enemy = E.getEnemy(state, id);
        if (enemy && enemy.hp > 0) {
          if (inst.cardId === 'push') {
            const laneEl = enemyEl.closest('.lane');
            const lane = parseInt(laneEl.dataset.lane, 10);
            const dir = lane < 2 ? 1 : -1;
            return { enemyId: id, direction: dir };
          }
          return { enemyId: id };
        }
      }
    }

    if (card.needsTarget === 'lane') {
      const laneEl = el.closest('.lane');
      if (laneEl) {
        return { lane: parseInt(laneEl.dataset.lane, 10) };
      }
    }

    return null;
  }

  function updateDropHighlights(x, y) {
    clearDropHighlights();
    const el = document.elementFromPoint(x, y);
    if (!el) return;
    const enemy = el.closest('.enemy');
    const lane = el.closest('.lane');
    const pz = el.closest('#player-zone');
    if (enemy) enemy.classList.add('drop-highlight');
    if (lane) lane.classList.add('drop-highlight');
    if (pz) pz.classList.add('drop-highlight');
  }

  function clearDropHighlights() {
    document.querySelectorAll('.drop-highlight').forEach((el) => {
      el.classList.remove('drop-highlight');
    });
  }

  // ── Hold tooltip ─────────────────────────────────────────────────────────

  function showCardTooltip(cardUid, x, y) {
    const inst = state.hand.find((c) => c.uid === cardUid);
    if (!inst) return;
    const card = E.CARDS[inst.cardId];
    const tooltip = document.getElementById('card-tooltip');
    tooltip.querySelector('h3').textContent = card.name;
    tooltip.querySelector('.tooltip-text').textContent = card.text;
    tooltip.querySelector('.tooltip-preview').textContent = 'Preview: ' + card.soloPreview;

    const kwContainer = tooltip.querySelector('.tooltip-keywords');
    kwContainer.innerHTML = card.keywords.map((k) =>
      '<span class="keyword" data-kw="' + k + '">' + k + '</span>'
    ).join('');
    kwContainer.querySelectorAll('.keyword').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        showGlossary(el.dataset.kw);
      });
    });

    tooltip.classList.add('visible');
  }

  function hideCardTooltip() {
    document.getElementById('card-tooltip').classList.remove('visible');
  }

  function showGlossary(keyword) {
    const text = E.GLOSSARY[keyword];
    if (!text) return;
    const popup = document.getElementById('glossary-popup');
    popup.querySelector('h4').textContent = keyword;
    popup.querySelector('p').textContent = text;
    popup.classList.add('visible');
  }

  // ── Juice: particles ─────────────────────────────────────────────────────

  function spawnInkSplash(targetEl, small) {
    const rect = targetEl.getBoundingClientRect();
    const appRect = app.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - appRect.left;
    const cy = rect.top + rect.height / 2 - appRect.top;
    const count = small ? 6 : 14;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (small ? 2 : 4) + Math.random() * 4;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        size: 2 + Math.random() * (small ? 3 : 5),
        color: Math.random() > 0.3 ? '#1a9e9e' : '#2a2a2a',
      });
    }
  }

  function particleLoop() {
    ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= p.decay;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(particleLoop);
  }

  function showDamagePop(targetEl, text, isBlock) {
    const rect = targetEl.getBoundingClientRect();
    const appRect = app.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'damage-pop' + (isBlock ? ' block' : '');
    pop.textContent = text;
    pop.style.left = (rect.left + rect.width / 2 - appRect.left) + 'px';
    pop.style.top = (rect.top - appRect.top) + 'px';
    app.appendChild(pop);
    setTimeout(() => pop.remove(), 700);
  }

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // ── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
