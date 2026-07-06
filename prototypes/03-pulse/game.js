/**
 * Pulse — canvas renderer, input, juice, audio
 */
(function () {
  'use strict';

  const FIXED_DT = 1 / 60;
  const HOLD_MS = 180;
  const DESIGN_W = PulseEngine.W;
  const DESIGN_H = PulseEngine.H;

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlayHint = document.getElementById('overlay-hint');
  const overlayEnd = document.getElementById('overlay-end');
  const endTitle = document.getElementById('end-title');
  const endStats = document.getElementById('end-stats');
  const btnRestart = document.getElementById('btn-restart');
  const btnHintStart = document.getElementById('btn-hint-start');
  const btnReset = document.getElementById('btn-reset');
  const assistToggle = document.getElementById('assist-toggle');
  const flowLabel = document.getElementById('flow-label');

  let game = PulseEngine.createGame(1337);
  let accumulator = 0;
  let lastTs = 0;
  let running = true;
  let pointer = {
    id: null,
    x: 0,
    y: 0,
    down: false,
    holdTimer: 0,
    dilated: false,
    cardIndex: -1,
    startX: 0,
    startY: 0,
    swipeTracked: false,
  };

  const particles = [];
  const floatTexts = [];
  const shake = { x: 0, y: 0, mag: 0, decay: 8 };
  const trails = [];
  let chroma = 0;
  let bloomPass = null;
  let audioCtx = null;

  function mulberryColor(hex, alpha) {
    return hex + Math.floor(alpha * 255).toString(16).padStart(2, '0');
  }

  let viewScale = 1;
  let viewOx = 0;
  let viewOy = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    viewScale = Math.min(rect.width / DESIGN_W, rect.height / DESIGN_H);
    viewOx = (rect.width - DESIGN_W * viewScale) / 2;
    viewOy = (rect.height - DESIGN_H * viewScale) / 2;
  }

  function applyViewTransform() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(
      dpr * viewScale, 0, 0, dpr * viewScale,
      dpr * viewOx, dpr * viewOy
    );
  }

  function toGameCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const sx = DESIGN_W / rect.width;
    const sy = DESIGN_H / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }

  function cardRects() {
    const n = game.hand.length;
    const cardW = 76;
    const cardH = 104;
    const gap = 10;
    const totalW = n * cardW + (n - 1) * gap;
    const startX = (DESIGN_W - totalW) / 2;
    const y = DESIGN_H - cardH - 24;
    return game.hand.map((_, i) => ({
      x: startX + i * (cardW + gap),
      y,
      w: cardW,
      h: cardH,
    }));
  }

  function hitCard(gx, gy) {
    const rects = cardRects();
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (gx >= r.x && gx <= r.x + r.w && gy >= r.y && gy <= r.y + r.h) return i;
    }
    return -1;
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    } catch (_) { /* optional */ }
    return audioCtx;
  }

  function playTone(freq, dur, type, vol) {
    const ac = ensureAudio();
    if (!ac) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const intensity = 0.08 + game.flow.multiplier * 0.02;
      g.gain.setValueAtTime((vol || 0.15) * intensity, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur);
    } catch (_) { /* optional */ }
  }

  function vibrate(ms) {
    try {
      navigator.vibrate?.(ms);
    } catch (_) { /* optional */ }
  }

  function addShake(mag) {
    shake.mag = Math.min(12, shake.mag + mag);
  }

  function spawnParticles(x, y, color, count, speed) {
    const n = count || 12;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (speed || 120) * (0.4 + Math.random() * 0.8);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  function floatText(x, y, text, color, size) {
    floatTexts.push({
      x,
      y,
      text,
      color: color || '#fff',
      life: 0.9,
      vy: -40,
      size: size || 18,
    });
  }

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'enemy_hit':
          spawnParticles(ev.data.x, ev.data.y, '#ff66cc', ev.data.crit ? 28 : 14, ev.data.crit ? 200 : 140);
          floatText(ev.data.x, ev.data.y - 30, '-' + ev.data.damage, ev.data.crit ? '#ffe040' : '#00f0ff', ev.data.crit ? 24 : 18);
          addShake(ev.data.crit ? 6 : 3);
          chroma = ev.data.crit ? 0.8 : 0.3;
          playTone(ev.data.crit ? 220 : 330, 0.12, 'square', 0.12);
          vibrate(ev.data.crit ? 25 : 12);
          break;
        case 'player_hit':
          spawnParticles(game.player.x, game.player.y, '#ff2244', 20, 160);
          floatText(game.player.x, game.player.y - 40, '-' + ev.data.damage, '#ff4466', 22);
          addShake(8);
          chroma = 0.5;
          playTone(110, 0.2, 'sawtooth', 0.15);
          vibrate(40);
          break;
        case 'dodge':
        case 'swipe_dodge':
          spawnParticles(game.player.x, game.player.y, '#a0ff40', 10, 100);
          playTone(440, 0.08, 'triangle', 0.1);
          vibrate(8);
          break;
        case 'fire':
        case 'cone':
        case 'pulse_wave':
        case 'nova':
          spawnParticles(ev.data.x, ev.data.y, ev.data.color || '#00f0ff', 16, 150);
          playTone(520, 0.06, 'sine', 0.08);
          break;
        case 'flow_up':
          if (flowLabel) flowLabel.textContent = '×' + game.flow.multiplier.toFixed(1);
          break;
        case 'flow_down':
          if (flowLabel) flowLabel.textContent = '×' + game.flow.multiplier.toFixed(1);
          break;
        case 'phase2':
          floatText(DESIGN_W / 2, DESIGN_H * 0.35, 'PHASE II', '#e040ff', 26);
          addShake(5);
          playTone(165, 0.3, 'sawtooth', 0.12);
          break;
        case 'victory':
          showEnd(true);
          break;
        case 'defeat':
          showEnd(false);
          break;
        default:
          break;
      }
    }
  }

  function showEnd(won) {
    overlayEnd.classList.remove('hidden');
    endTitle.textContent = won ? 'PULSE CLEAR' : 'SIGNAL LOST';
    endTitle.className = won ? 'end-title win' : 'end-title lose';
    const s = game.stats;
    endStats.innerHTML =
      'Flow peak: <strong>×' + game.flow.peak.toFixed(1) + '</strong><br>' +
      'Score: <strong>' + game.flow.score + '</strong><br>' +
      'Hits: ' + s.hits + ' · Dodges: ' + s.dodges + ' · Cards: ' + s.cardsPlayed;
    playTone(won ? 523 : 130, won ? 0.4 : 0.5, won ? 'triangle' : 'sawtooth', 0.15);
  }

  function hideOverlays() {
    overlayHint.classList.add('hidden');
    overlayEnd.classList.add('hidden');
  }

  function startRun() {
    hideOverlays();
    game = PulseEngine.resetGame(game, game.seed);
    game.assistSlow = assistToggle?.checked || false;
    pointer.cardIndex = -1;
    pointer.dilated = false;
    game.aiming = null;
    particles.length = 0;
    floatTexts.length = 0;
    if (flowLabel) flowLabel.textContent = '×1.0';
    running = true;
    accumulator = 0;
  }

  function setPaused(p) {
    game.paused = p;
  }

  function onPointerDown(e) {
    if (game.phase !== 'playing' || game.paused) return;
    e.preventDefault();
    ensureAudio();
    const pt = toGameCoords(e.clientX, e.clientY);
    pointer.id = e.pointerId;
    pointer.x = pt.x;
    pointer.y = pt.y;
    pointer.startX = pt.x;
    pointer.startY = pt.y;
    pointer.down = true;
    pointer.holdTimer = 0;
    pointer.dilated = false;
    pointer.swipeTracked = false;
    pointer.cardIndex = hitCard(pt.x, pt.y);
    canvas.setPointerCapture(e.pointerId);
    if (pointer.cardIndex >= 0) {
      game.aiming = {
        cardIndex: pointer.cardIndex,
        tx: pt.x,
        ty: pt.y,
        dilated: false,
      };
    }
  }

  function onPointerMove(e) {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    e.preventDefault();
    const pt = toGameCoords(e.clientX, e.clientY);
    pointer.x = pt.x;
    pointer.y = pt.y;
    if (game.aiming) {
      game.aiming.tx = pt.x;
      game.aiming.ty = Math.min(pt.y, DESIGN_H * 0.55);
    }
    const dx = pt.x - pointer.startX;
    const dy = pt.y - pointer.startY;
    if (!pointer.swipeTracked && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (pointer.cardIndex < 0) {
        pointer.swipeTracked = true;
        PulseEngine.playerDodge(game, dx < 0 ? -1 : 1);
        spawnParticles(game.player.x, game.player.y, '#88ffcc', 8, 90);
      }
    }
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointer.id) return;
    e.preventDefault();
    const wasDilated = pointer.dilated;
    if (pointer.cardIndex >= 0 && game.aiming) {
      const card = game.hand[pointer.cardIndex];
      if (card && game.player.energy >= card.cost) {
        const tx = game.aiming.tx;
        const ty = game.aiming.ty;
        PulseEngine.playCard(game, pointer.cardIndex, tx, ty);
        if (wasDilated) chroma = 0.4;
        addShake(card.type === 'nova' ? 7 : 3);
      }
    }
    game.aiming = null;
    pointer.down = false;
    pointer.dilated = false;
    pointer.cardIndex = -1;
    pointer.id = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) { /* ok */ }
  }

  function onPointerCancel(e) {
    onPointerUp(e);
    setPaused(true);
  }

  function drawGrid(w, h) {
    const horizon = h * 0.42;
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0a0018');
    grd.addColorStop(0.45, '#12002a');
    grd.addColorStop(1, '#1a0035');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 200, 0.15)';
    ctx.lineWidth = 1;
    const gridTop = horizon;
    const vanishX = w * 0.5;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(vanishX, gridTop);
      ctx.lineTo(vanishX + i * 80, h);
      ctx.stroke();
    }
    for (let j = 0; j < 12; j++) {
      const t = j / 12;
      const y = gridTop + (h - gridTop) * t * t;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    const sunGrd = ctx.createRadialGradient(w * 0.5, gridTop - 20, 10, w * 0.5, gridTop - 20, 120);
    sunGrd.addColorStop(0, 'rgba(255, 80, 200, 0.35)');
    sunGrd.addColorStop(0.5, 'rgba(120, 0, 255, 0.12)');
    sunGrd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGrd;
    ctx.fillRect(0, 0, w, gridTop + 40);
  }

  function drawTelegraph(enemy) {
    const atk = enemy.attack;
    if (!atk || !atk.active) return;
    const prog = Math.min(1, atk.progress);
    const p = game.player;
    const alpha = 0.35 + prog * 0.45;

    ctx.save();
    if (atk.type === 'aoe') {
      const tx = p.x;
      const ty = p.y;
      ctx.strokeStyle = mulberryColor(atk.color, alpha);
      ctx.fillStyle = mulberryColor(atk.color, alpha * 0.25);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, atk.radius * (0.6 + prog * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawArrow(enemy.x, enemy.y + 30, tx, ty, atk.color, prog);
    } else if (atk.type === 'swipe') {
      const side = atk.dir < 0 ? 'LEFT' : 'RIGHT';
      const bx = p.x + atk.dir * 60;
      ctx.fillStyle = mulberryColor(atk.color, alpha * 0.3);
      ctx.fillRect(bx - atk.width / 2, p.y - 40, atk.width, 80);
      ctx.fillStyle = atk.color;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('SWIPE ' + side, bx, p.y - 50);
      drawArrow(enemy.x, enemy.y, bx, p.y, atk.color, prog);
    } else if (atk.type === 'beam') {
      ctx.strokeStyle = mulberryColor(atk.color, alpha);
      ctx.lineWidth = atk.width;
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      drawArrow(enemy.x, enemy.y, p.x, p.y, atk.color, prog);
    }

    const barW = 100;
    const barX = enemy.x - barW / 2;
    const barY = enemy.y - enemy.radius - 28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, 8);
    ctx.fillStyle = atk.color;
    ctx.shadowColor = atk.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(barX, barY, barW * prog, 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(atk.name + ' ' + Math.ceil(atk.damage), enemy.x, barY - 4);
    ctx.restore();
  }

  function drawArrow(x1, y1, x2, y2, color, prog) {
    const mx = x1 + (x2 - x1) * prog;
    const my = y1 + (y2 - y1) * prog;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = mulberryColor(color, 0.7);
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mx, my);
    ctx.stroke();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -5);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e) {
    if (!e.alive && e.phase === 2) return;
    const pulse = 1 + Math.sin(game.simTime * 4) * 0.04;
    const r = e.radius * pulse;
    const flash = e.hitFlash > 0 ? 1 : 0;

    ctx.save();
    ctx.translate(e.x + (Math.random() - 0.5) * e.windShake * 8, e.y);
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.4);
    g.addColorStop(0, flash ? '#ffffff' : '#ff40aa');
    g.addColorStop(0.6, '#aa20ff');
    g.addColorStop(1, 'rgba(100,0,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff66dd';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur = 16 + game.flow.multiplier * 4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    const hpPct = e.hp / e.maxHp;
    const barW = 80;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-barW / 2, -r - 18, barW, 6);
    ctx.fillStyle = hpPct > 0.3 ? '#00ffaa' : '#ff4466';
    ctx.fillRect(-barW / 2, -r - 18, barW * hpPct, 6);
    ctx.fillStyle = '#e0c0ff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(e.name, 0, -r - 24);
    ctx.restore();

    drawTelegraph(e);
  }

  function drawPlayer(p) {
    const flow = game.flow.multiplier;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(77, 140, 255, 0.7)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#4d8cff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const globe = ctx.createRadialGradient(-8, -8, 4, 0, 0, p.radius);
    const flash = p.hitFlash > 0;
    globe.addColorStop(0, flash ? '#ffaaaa' : '#aaffff');
    globe.addColorStop(0.5, flash ? '#ff4488' : '#00ccff');
    globe.addColorStop(1, '#0044aa');
    ctx.fillStyle = globe;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 14 + flow * 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (p.iframe > 0) {
      ctx.strokeStyle = 'rgba(160, 255, 64, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(p.hp), 0, 5);
    ctx.restore();
  }

  function drawEnergyBar(p) {
    const bx = 24;
    const by = DESIGN_H - 148;
    const bw = DESIGN_W - 48;
    const bh = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(bx, by, bw, bh);
    const pct = p.energy / p.maxEnergy;
    const eg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    eg.addColorStop(0, '#ff00aa');
    eg.addColorStop(1, '#00f0ff');
    ctx.fillStyle = eg;
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur = 6;
    ctx.fillRect(bx, by, bw * pct, bh);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('ENERGY', bx, by - 4);
  }

  function drawFlowMeter() {
    const fx = DESIGN_W - 70;
    const fy = 52;
    const f = game.flow.multiplier;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff00cc';
    ctx.shadowColor = '#ff00cc';
    ctx.shadowBlur = 8 + f * 4;
    ctx.beginPath();
    ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + (f / 5) * Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('×' + f.toFixed(1), 0, 4);
    ctx.font = '9px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('FLOW', 0, 16);
    ctx.restore();
  }

  function drawCards() {
    const rects = cardRects();
    const selected = pointer.cardIndex;
    const dilated = pointer.dilated;

    game.hand.forEach((card, i) => {
      const r = rects[i];
      const isSel = i === selected;
      const canAfford = game.player.energy >= card.cost;

      ctx.save();
      const lift = isSel ? (dilated ? -18 : -10) : 0;
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + lift);

      if (isSel && dilated) {
        ctx.shadowColor = card.color;
        ctx.shadowBlur = 24;
      }

      ctx.fillStyle = 'rgba(10, 5, 30, 0.85)';
      ctx.strokeStyle = canAfford ? card.color : 'rgba(120,120,120,0.5)';
      ctx.lineWidth = isSel ? 3 : 2;
      roundRect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = canAfford ? card.color : '#666';
      ctx.font = '22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(card.glyph, 0, -12);
      ctx.font = 'bold 11px system-ui';
      ctx.fillStyle = '#fff';
      ctx.fillText(card.name, 0, 14);
      ctx.font = '10px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(card.cost + ' EN', 0, 30);
      if (card.damage) {
        ctx.fillStyle = '#ff88cc';
        ctx.fillText(card.damage + ' DMG', 0, 42);
      }
      ctx.restore();
    });
  }

  function roundRect(c, x, y, w, h, rad) {
    c.beginPath();
    c.moveTo(x + rad, y);
    c.lineTo(x + w - rad, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad);
    c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad);
    c.lineTo(x, y + rad);
    c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
  }

  function drawPreview() {
    if (!game.aiming || pointer.cardIndex < 0) return;
    const card = game.hand[pointer.cardIndex];
    if (!card) return;
    const prev = PulseEngine.previewCard(game, card, game.aiming.tx, game.aiming.ty);

    ctx.save();
    ctx.globalAlpha = 0.75;
    for (const s of prev.shapes) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = mulberryColor(s.color, s.alpha || 0.3);
      ctx.lineWidth = 2;
      if (s.kind === 'line') {
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (s.kind === 'circle') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (s.kind === 'cone') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, s.r, s.angle - s.spread, s.angle + s.spread);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (s.kind === 'ring') {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.kind === 'dash') {
        ctx.fillStyle = mulberryColor(s.color, 0.4);
        ctx.fillRect(s.x + s.dir * 20, s.y - 20, s.dir * 70, 40);
      }
    }
    if (prev.damage) {
      const tx = prev.willHit ? game.enemy.x : prev.tx;
      const ty = prev.willHit ? game.enemy.y - 50 : prev.ty;
      ctx.fillStyle = prev.willHit ? '#00ffaa' : '#ffaa00';
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(prev.damage + (prev.willHit ? ' ✓' : '?'), tx, ty);
    }
    if (prev.block) {
      ctx.fillStyle = '#4d8cff';
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('+' + prev.block + ' BLOCK', game.player.x, game.player.y - 50);
    }
    if (pointer.dilated) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('SLOW-MO AIM — release to fire', DESIGN_W / 2, 100);
    }
    ctx.restore();
  }

  function drawProjectiles() {
    for (const pr of game.projectiles) {
      ctx.save();
      ctx.fillStyle = pr.color;
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.fill();
      trails.push({ x: pr.x, y: pr.y, color: pr.color, life: 0.15 });
      ctx.restore();
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      const a = p.life / p.maxLife;
      ctx.fillStyle = mulberryColor(p.color, a);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      const t = trails[i];
      t.life -= dt;
      if (t.life <= 0) {
        trails.splice(i, 1);
        continue;
      }
      ctx.fillStyle = mulberryColor(t.color, t.life / 0.15 * 0.4);
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFloatTexts(dt) {
    ctx.textAlign = 'center';
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const ft = floatTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) {
        floatTexts.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.min(1, ft.life);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold ' + ft.size + 'px system-ui';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawPauseBadge() {
    if (!game.paused) return;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', DESIGN_W / 2, DESIGN_H / 2);
  }

  function render(alpha) {
    const w = DESIGN_W;
    const h = DESIGN_H;
    shake.mag = Math.max(0, shake.mag - shake.decay * (1 / 60));
    shake.x = (Math.random() - 0.5) * shake.mag;
    shake.y = (Math.random() - 0.5) * shake.mag;
    chroma *= 0.9;

    ctx.save();
    applyViewTransform();
    ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.translate(shake.x, shake.y);

    if (chroma > 0.05) {
      ctx.save();
      drawScene(w, h);
      ctx.globalCompositeOperation = 'screen';
      ctx.translate(2 * chroma, 0);
      ctx.globalAlpha = chroma * 0.35;
      drawScene(w, h);
      ctx.translate(-4 * chroma, 0);
      ctx.globalAlpha = chroma * 0.35;
      drawScene(w, h);
      ctx.restore();
    } else {
      drawScene(w, h);
    }
    ctx.restore();
  }

  function drawScene(w, h) {
    drawGrid(w, h);
    drawProjectiles();
    drawEnemy(game.enemy);
    drawPlayer(game.player);
    drawPreview();
    drawEnergyBar(game.player);
    drawFlowMeter();
    drawCards();
    drawParticles(1 / 60);
    drawFloatTexts(1 / 60);
    drawPauseBadge();

    if (game.phase === 'playing' && pointer.dilated) {
      ctx.fillStyle = 'rgba(180, 80, 255, 0.08)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  function updateHold(realDt) {
    if (!pointer.down || pointer.cardIndex < 0) return;
    pointer.holdTimer += realDt * 1000;
    if (pointer.holdTimer >= HOLD_MS && !pointer.dilated) {
      pointer.dilated = true;
      if (game.aiming) game.aiming.dilated = true;
      playTone(180, 0.15, 'sine', 0.06);
    }
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    let realDt = (ts - lastTs) / 1000;
    lastTs = ts;
    realDt = Math.min(realDt, 0.1);

    updateHold(realDt);

    if (running && !game.paused && game.phase === 'playing') {
      accumulator += realDt;
      while (accumulator >= FIXED_DT) {
        PulseEngine.step(game, FIXED_DT);
        accumulator -= FIXED_DT;
      }
      handleEvents(PulseEngine.drainEvents(game));
    }

    render(accumulator / FIXED_DT);
    requestAnimationFrame(loop);
  }

  function init() {
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('visibilitychange', () => {
      setPaused(document.hidden);
    });

    btnHintStart?.addEventListener('click', startRun);
    btnRestart?.addEventListener('click', startRun);
    btnReset?.addEventListener('click', startRun);
    assistToggle?.addEventListener('change', () => {
      game.assistSlow = assistToggle.checked;
    });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
