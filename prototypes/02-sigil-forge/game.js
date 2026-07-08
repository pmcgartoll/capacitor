/**
 * Sigil Forge — Renderer & interaction layer
 */
(function () {
  'use strict';

  const E = window.SigilEngine;
  const boardEl = document.getElementById('board');
  const synergyCanvas = document.getElementById('synergy-canvas');
  const particleCanvas = document.getElementById('particle-canvas');
  const synergyCtx = synergyCanvas.getContext('2d');
  const particleCtx = particleCanvas.getContext('2d');

  let state = E.createGameState(Date.now());
  E.startSteerPhase(state);

  let particles = [];
  let animFrame = null;
  let spinAnimating = false;
  let dragState = null;
  let holdTimer = null;
  let holdType = null;
  let previewActive = false;
  let selectedDraft = null;
  let drawerOpen = false;
  let activeTab = 'draft';
  let glossaryEl = null;

  const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

  function playTone(freq, duration, vol) {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) { /* noop */ }
  }

  function vibrate(ms) {
    try { navigator.vibrate?.(ms); } catch (_) { /* noop */ }
  }

  function resizeCanvases() {
    const wrap = boardEl.parentElement;
    const rect = wrap.getBoundingClientRect();
    synergyCanvas.width = rect.width;
    synergyCanvas.height = rect.height;
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }

  function getSlotCenter(index) {
    const slot = boardEl.children[index];
    if (!slot) return { x: 0, y: 0 };
    const boardRect = boardEl.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    return {
      x: slotRect.left + slotRect.width / 2 - boardRect.left,
      y: slotRect.top + slotRect.height / 2 - boardRect.top,
    };
  }

  function spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        size: 3 + Math.random() * 4,
        color: color || '#5ecfff',
      });
    }
  }

  function updateParticles() {
    particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    particles = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      particleCtx.globalAlpha = p.life;
      particleCtx.fillStyle = p.color;
      particleCtx.beginPath();
      particleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      particleCtx.fill();
      return true;
    });
    particleCtx.globalAlpha = 1;
    if (particles.length > 0) {
      animFrame = requestAnimationFrame(updateParticles);
    } else {
      animFrame = null;
    }
  }

  function burstAtSlot(index, color) {
    const slot = boardEl.children[index];
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 12, color);
    if (!animFrame) animFrame = requestAnimationFrame(updateParticles);
  }

  function drawSynergyLines(links) {
    synergyCtx.clearRect(0, 0, synergyCanvas.width, synergyCanvas.height);
    if (!links.length) return;
    const boardRect = boardEl.getBoundingClientRect();
    const wrapRect = boardEl.parentElement.getBoundingClientRect();
    const offsetX = boardRect.left - wrapRect.left;
    const offsetY = boardRect.top - wrapRect.top;

    links.forEach((link, i) => {
      const from = getSlotCenter(link.from);
      const to = getSlotCenter(link.to);
      const fx = from.x + offsetX;
      const fy = from.y + offsetY;
      const tx = to.x + offsetX;
      const ty = to.y + offsetY;

      synergyCtx.strokeStyle = `rgba(240, 216, 120, ${0.5 + 0.5 * Math.sin(Date.now() / 200 + i)})`;
      synergyCtx.lineWidth = 2;
      synergyCtx.setLineDash([6, 4]);
      synergyCtx.beginPath();
      synergyCtx.moveTo(fx, fy);
      const mx = (fx + tx) / 2;
      const my = (fy + ty) / 2 - 20;
      synergyCtx.quadraticCurveTo(mx, my, tx, ty);
      synergyCtx.stroke();
      synergyCtx.setLineDash([]);
    });
  }

  function clearSynergyLines() {
    synergyCtx.clearRect(0, 0, synergyCanvas.width, synergyCanvas.height);
  }

  function symbolHTML(id, compact) {
    const def = E.SYMBOLS[id];
    if (!def) return '';
    const arch = def.archetype || 'arcane';
    if (compact) {
      return `<div class="symbol archetype-${arch}">
        <span class="symbol-glyph">${def.glyph}</span>
        <span class="symbol-name">${def.name}</span>
      </div>`;
    }
    return `<div class="symbol archetype-${arch}">
      <span class="symbol-glyph">${def.glyph}</span>
      <span class="symbol-name">${def.name}</span>
    </div>`;
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    for (let i = 0; i < E.COLS * E.ROWS; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot' + (state.board[i] ? '' : ' empty');
      slot.dataset.index = i;

      const order = document.createElement('span');
      order.className = 'read-order';
      order.textContent = i + 1;
      slot.appendChild(order);

      if (i < E.COLS * E.ROWS - 1 && (i + 1) % E.COLS !== 0) {
        const arrow = document.createElement('span');
        arrow.className = 'read-arrow';
        arrow.textContent = '→';
        slot.appendChild(arrow);
      } else if (i < E.COLS * (E.ROWS - 1)) {
        const arrow = document.createElement('span');
        arrow.className = 'read-arrow';
        arrow.textContent = '↓';
        slot.appendChild(arrow);
      }

      if (state.board[i]) {
        slot.insertAdjacentHTML('beforeend', symbolHTML(state.board[i].id, true));
      }

      boardEl.appendChild(slot);
    }
    requestAnimationFrame(resizeCanvases);
  }

  function updateHUD() {
    const quota = E.getQuota(state);
    document.getElementById('quota-label').textContent = quota;
    document.getElementById('earned-label').textContent = state.roundEssence || 0;
    const pct = Math.min(100, ((state.roundEssence || 0) / quota) * 100);
    document.getElementById('quota-fill').style.width = pct + '%';

    const roundNum = state.round + 1;
    const boss = E.isBossRound(state);
    document.getElementById('round-badge').textContent =
      boss ? `Boss · Round ${roundNum}` : `Round ${roundNum}`;

    document.getElementById('blueprint-count').textContent = state.blueprintTokens;
    document.getElementById('pity-fill').style.width =
      (state.pityMeter / state.pityThreshold) * 100 + '%';
    document.getElementById('pity-label').textContent =
      `Pity: ${state.pityMeter} / ${state.pityThreshold}` +
      (state.wishArchetype ? ` (${E.ARCHETYPES[state.wishArchetype].label})` : '');

    const spinBtn = document.getElementById('btn-spin');
    spinBtn.disabled = state.phase !== 'steer' || spinAnimating;
    spinBtn.textContent = state.phase === 'steer' ? 'Forge Spin' : 'Spinning…';
  }

  function buildDraftRow() {
    const row = document.getElementById('draft-row');
    row.innerHTML = '';
    state.draftOptions.forEach((opt, i) => {
      const card = document.createElement('div');
      card.className = 'draft-card' + (selectedDraft === i ? ' selected' : '');
      card.dataset.draftIndex = i;
      card.dataset.symbolId = opt.id;
      card.innerHTML = symbolHTML(opt.id, true) +
        `<span class="symbol-name" style="font-size:0.55rem;margin-top:4px">${E.SYMBOLS[opt.id].reminder}</span>`;
      row.appendChild(card);
    });
  }

  function buildCatalog() {
    const grid = document.getElementById('catalog-grid');
    grid.innerHTML = '';
    E.DRAFT_POOL.forEach((id) => {
      const def = E.SYMBOLS[id];
      const item = document.createElement('div');
      item.className = 'catalog-item';
      item.dataset.symbolId = id;
      item.innerHTML = `
        <span class="symbol-glyph archetype-${def.archetype}">${def.glyph}</span>
        <span class="symbol-name">${def.name}</span>
        <span class="cost">${E.BLUEPRINT_COST} tokens</span>`;
      grid.appendChild(item);
    });
  }

  function buildWishButtons() {
    const container = document.getElementById('wish-buttons');
    container.innerHTML = '';
    const none = document.createElement('button');
    none.className = 'wish-btn' + (!state.wishArchetype ? ' active' : '');
    none.textContent = 'None';
    none.dataset.wish = '';
    none.style.color = '#a89878';
    container.appendChild(none);

    Object.values(E.ARCHETYPES).forEach((arch) => {
      const btn = document.createElement('button');
      btn.className = 'wish-btn' + (state.wishArchetype === arch.id ? ' active' : '');
      btn.textContent = arch.label;
      btn.dataset.wish = arch.id;
      btn.style.color = arch.color;
      container.appendChild(btn);
    });
  }

  function buildFusionList() {
    const list = document.getElementById('fusion-list');
    const shown = new Set();
    const entries = [];
    for (const key of Object.keys(E.FUSION_TABLE)) {
      const [a, b] = key.split('+');
      if (a !== b) {
        const norm = [a, b].sort().join('+');
        if (shown.has(norm)) continue;
        shown.add(norm);
      }
      const result = E.SYMBOLS[E.FUSION_TABLE[key]];
      if (!result || result.fusion === false) continue;
      entries.push({ a: E.SYMBOLS[a], b: E.SYMBOLS[b], result });
    }
    const unique = [];
    const seen = new Set();
    for (const e of entries) {
      const k = `${e.a.id}+${e.b.id}->${e.result.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(e);
    }
    list.innerHTML = unique.map((e) =>
      `<li>${e.a.glyph} ${e.a.name} + ${e.b.glyph} ${e.b.name} → ${e.result.glyph} <strong>${e.result.name}</strong></li>`
    ).join('');
  }

  function render() {
    buildBoard();
    buildDraftRow();
    buildCatalog();
    buildWishButtons();
    buildFusionList();
    updateHUD();
    updateOverlays();
  }

  function updateOverlays() {
    document.getElementById('overlay-win').classList.toggle('hidden', state.phase !== 'win');
    document.getElementById('overlay-lose').classList.toggle('hidden', state.phase !== 'lose');
    if (state.phase === 'lose') {
      document.getElementById('lose-message').textContent =
        `Earned ${state.roundEssence} — needed ${E.getQuota(state)} essence.`;
    }
  }

  function showPreview() {
    const preview = E.resolveBoard(state.board);
    previewActive = true;
    const banner = document.getElementById('preview-banner');
    banner.textContent = `Preview: ${preview.total} essence`;
    banner.classList.add('visible');

    const quota = E.getQuota(state);
    const prevPct = Math.min(100, (preview.total / quota) * 100);
    document.getElementById('quota-preview').style.width = prevPct + '%';

    const chainIndices = new Set(preview.chain.map((c) => c.index));
    Array.from(boardEl.children).forEach((slot, i) => {
      slot.classList.toggle('chain-active', chainIndices.has(i));
    });

    document.getElementById('btn-spin').classList.add('holding');
    document.getElementById('total-number').textContent = preview.total;
  }

  function hidePreview() {
    previewActive = false;
    document.getElementById('preview-banner').classList.remove('visible');
    document.getElementById('quota-preview').style.width = '0%';
    Array.from(boardEl.children).forEach((slot) => {
      slot.classList.remove('chain-active');
    });
    document.getElementById('btn-spin').classList.remove('holding');
    document.getElementById('total-number').textContent = '';
  }

  function showSymbolSynergy(index) {
    const sym = state.board[index];
    if (!sym) return;
    const def = E.SYMBOLS[sym.id];
    const links = E.getSynergyLinks(state.board, index);
    drawSynergyLines(links);

    const slot = boardEl.children[index];
    let tip = slot.querySelector('.synergy-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'synergy-tooltip';
      slot.appendChild(tip);
    }
    const reminderHtml = def.reminder.replace(
      /\b(\w+)\b/g,
      (word) => {
        if (E.GLOSSARY[word]) {
          return `<span class="keyword" data-kw="${word}">${word}</span>`;
        }
        return word;
      }
    );
    tip.innerHTML = `<strong>${def.name}</strong><br>${reminderHtml}`;
    tip.querySelectorAll('.keyword').forEach((kw) => {
      kw.addEventListener('click', (ev) => {
        ev.stopPropagation();
        showGlossary(kw.dataset.kw);
      });
    });
    slot.classList.add('chain-active');
  }

  function hideSymbolSynergy() {
    clearSynergyLines();
    document.querySelectorAll('.synergy-tooltip').forEach((el) => el.remove());
    Array.from(boardEl.children).forEach((slot) => {
      if (!previewActive) slot.classList.remove('chain-active');
    });
    hideGlossary();
  }

  function showGlossary(keyword) {
    hideGlossary();
    const text = E.GLOSSARY[keyword];
    if (!text) return;
    glossaryEl = document.createElement('div');
    glossaryEl.className = 'glossary-popup';
    glossaryEl.innerHTML = `<strong>${keyword}</strong>: ${text}`;
    document.body.appendChild(glossaryEl);
  }

  function hideGlossary() {
    if (glossaryEl) {
      glossaryEl.remove();
      glossaryEl = null;
    }
  }

  async function animateSpin(preview) {
    spinAnimating = true;
    state.phase = 'spin';
    updateHUD();

    const slots = Array.from(boardEl.children);
    slots.forEach((s) => s.classList.remove('chain-active', 'chain-done'));

    let runningTotal = 0;
    const totalEl = document.getElementById('total-number');
    const app = document.getElementById('app');
    let maxChain = 0;

    for (let ci = 0; ci < preview.chain.length; ci++) {
      const step = preview.chain[ci];
      const slot = slots[step.index];
      if (!slot) continue;

      slot.classList.add('chain-active');
      maxChain = ci + 1;

      const pitch = 220 + ci * 40;
      playTone(pitch, 0.12, 0.06 + ci * 0.01);
      vibrate(15 + ci * 5);

      if (step.payout > 0) {
        const pop = document.createElement('span');
        pop.className = 'symbol-payout-pop';
        pop.textContent = '+' + step.payout;
        slot.appendChild(pop);
        setTimeout(() => pop.remove(), 700);

        const def = E.SYMBOLS[step.symbolId];
        const archColor = E.ARCHETYPES[def?.archetype]?.color || '#5ecfff';
        burstAtSlot(step.index, archColor);
      }

      runningTotal = step.runningTotal;
      totalEl.textContent = runningTotal;
      totalEl.style.transform = `scale(${1 + ci * 0.03})`;

      document.getElementById('earned-label').textContent = runningTotal;
      const quota = E.getQuota(state);
      document.getElementById('quota-fill').style.width =
        Math.min(100, (runningTotal / quota) * 100) + '%';

      await delay(280 + Math.min(ci * 20, 120));
      slot.classList.remove('chain-active');
      slot.classList.add('chain-done');
    }

    totalEl.style.transform = '';
    if (maxChain >= 5) {
      totalEl.classList.add('big-combo');
      app.classList.add('screen-warp');
      playTone(660, 0.3, 0.12);
      vibrate(80);
      setTimeout(() => {
        totalEl.classList.remove('big-combo');
        app.classList.remove('screen-warp');
      }, 500);
    }

    await delay(400);
    E.finishSpin(state, preview.total);
    state.roundEssence = preview.total;
    spinAnimating = false;
    render();
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function openDrawer() {
    drawerOpen = true;
    document.getElementById('drawer').classList.add('open');
  }

  function closeDrawer() {
    drawerOpen = false;
    document.getElementById('drawer').classList.remove('open');
  }

  function toggleDrawer() {
    if (drawerOpen) closeDrawer();
    else openDrawer();
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.drawer-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.add('hidden');
    });
    document.getElementById('tab-' + tab).classList.remove('hidden');
  }

  function getBoardIndexFromPoint(x, y) {
    const slots = Array.from(boardEl.children);
    for (const slot of slots) {
      const r = slot.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return parseInt(slot.dataset.index, 10);
      }
    }
    return -1;
  }

  function startDrag(pointerId, source, symbolId, fromIndex) {
    dragState = { pointerId, source, symbolId, fromIndex, ghost: null };
    if (source === 'board') {
      boardEl.children[fromIndex]?.classList.add('dragging');
    }
  }

  function endDrag(clientX, clientY) {
    if (!dragState) return;
    const { source, symbolId, fromIndex } = dragState;

    if (dragState.ghost) {
      dragState.ghost.remove();
    }
    if (source === 'board') {
      boardEl.children[fromIndex]?.classList.remove('dragging');
    }

    const targetIndex = getBoardIndexFromPoint(clientX, clientY);

    if (source === 'draft' && targetIndex >= 0) {
      if (!state.board[targetIndex]) {
        E.placeSymbol(state, targetIndex, symbolId);
        state.draftOptions.splice(
          state.draftOptions.findIndex((o) => o.id === symbolId), 1
        );
        if (state.draftOptions.length === 0) {
          state.draftOptions = E.generateDraftOptions(state);
        }
        playTone(440, 0.1, 0.08);
        vibrate(20);
      }
    } else if (source === 'board' && targetIndex >= 0 && targetIndex !== fromIndex) {
      const targetSym = state.board[targetIndex];
      if (!targetSym) {
        state.board[targetIndex] = state.board[fromIndex];
        state.board[fromIndex] = null;
      } else {
        const fused = E.applyFusion(state, fromIndex, targetIndex);
        if (fused) {
          playTone(523, 0.2, 0.1);
          vibrate(40);
          burstAtSlot(targetIndex, '#e85a28');
        }
      }
    }

    Array.from(boardEl.children).forEach((s) => s.classList.remove('drop-target', 'fusion-target'));
    dragState = null;
    render();
  }

  function onPointerDown(e) {
    if (spinAnimating) return;
    const target = e.target.closest('[data-index], .draft-card, #btn-spin, .catalog-item, .wish-btn');
    if (!target) return;

    if (target.id === 'btn-spin' && state.phase === 'steer') {
      holdType = 'spin';
      holdTimer = setTimeout(() => {
        showPreview();
      }, 300);
      return;
    }

    const slot = target.closest('.slot');
    if (slot && state.board[slot.dataset.index] && state.phase === 'steer') {
      const idx = parseInt(slot.dataset.index, 10);
      holdType = 'symbol';
      holdTimer = setTimeout(() => {
        showSymbolSynergy(idx);
      }, 350);
      return;
    }

    if (target.classList.contains('draft-card') && state.phase === 'steer') {
      e.preventDefault();
      startDrag(e.pointerId, 'draft', target.dataset.symbolId, -1);
      return;
    }

    const slotEl = target.closest('.slot');
    if (slotEl && state.board[slotEl.dataset.index] && state.phase === 'steer') {
      e.preventDefault();
      const idx = parseInt(slotEl.dataset.index, 10);
      startDrag(e.pointerId, 'board', state.board[idx].id, idx);
    }
  }

  function onPointerMove(e) {
    if (dragState) {
      const targetIndex = getBoardIndexFromPoint(e.clientX, e.clientY);
      Array.from(boardEl.children).forEach((s, i) => {
        s.classList.remove('drop-target', 'fusion-target');
        if (i === targetIndex) {
          if (dragState.source === 'draft' && !state.board[i]) {
            s.classList.add('drop-target');
          } else if (dragState.source === 'board' && i !== dragState.fromIndex && state.board[i]) {
            s.classList.add('fusion-target');
          } else if (dragState.source === 'board' && !state.board[i]) {
            s.classList.add('drop-target');
          }
        }
      });
    }
  }

  function onPointerUp(e) {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }

    if (holdType === 'spin') {
      if (previewActive) {
        hidePreview();
      } else if (state.phase === 'steer' && !spinAnimating) {
        closeDrawer();
        const preview = E.resolveBoard(state.board);
        animateSpin(preview);
      }
      holdType = null;
      return;
    }

    if (holdType === 'symbol') {
      hideSymbolSynergy();
      holdType = null;
      return;
    }

    if (dragState) {
      endDrag(e.clientX, e.clientY);
    }
  }

  function onPointerCancel() {
    if (holdTimer) clearTimeout(holdTimer);
    hidePreview();
    hideSymbolSynergy();
    if (dragState) {
      if (dragState.source === 'board') {
        boardEl.children[dragState.fromIndex]?.classList.remove('dragging');
      }
      dragState = null;
    }
    holdType = null;
  }

  // Event wiring
  boardEl.addEventListener('pointerdown', onPointerDown);
  document.getElementById('draft-row').addEventListener('pointerdown', onPointerDown);
  document.getElementById('btn-spin').addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);

  document.getElementById('btn-spin').addEventListener('contextmenu', (e) => e.preventDefault());

  document.getElementById('btn-drawer').addEventListener('click', toggleDrawer);
  document.getElementById('drawer-handle').addEventListener('click', toggleDrawer);

  document.querySelectorAll('.drawer-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('catalog-grid').addEventListener('click', (e) => {
    const item = e.target.closest('.catalog-item');
    if (!item || state.phase !== 'steer') return;
    const id = item.dataset.symbolId;
    if (E.blueprintPull(state, id)) {
      playTone(392, 0.15, 0.1);
      vibrate(30);
      render();
    }
  });

  document.getElementById('wish-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('.wish-btn');
    if (!btn) return;
    state.wishArchetype = btn.dataset.wish || null;
    render();
  });

  function resetRun() {
    state = E.resetGame(Date.now());
    E.startSteerPhase(state);
    spinAnimating = false;
    hidePreview();
    hideSymbolSynergy();
    closeDrawer();
    render();
  }

  document.getElementById('btn-reset').addEventListener('click', resetRun);
  document.getElementById('btn-win-reset').addEventListener('click', resetRun);
  document.getElementById('btn-lose-reset').addEventListener('click', resetRun);

  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  window.addEventListener('resize', resizeCanvases);

  // Init
  render();
})();
