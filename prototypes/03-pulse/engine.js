/**
 * Pulse — deterministic game logic (renderer-agnostic)
 */
(function (global) {
  'use strict';

  const W = 390;
  const H = 844;

  function createRng(seed) {
    let s = seed >>> 0;
    return {
      seed: seed,
      next() {
        s += 0x6d2b79f5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
      },
      pick(arr) {
        return arr[this.int(0, arr.length - 1)];
      },
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = this.int(0, i);
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
    };
  }

  const CARD_DEFS = {
    bolt: {
      id: 'bolt',
      name: 'Bolt',
      cost: 25,
      damage: 14,
      type: 'projectile',
      speed: 520,
      color: '#00f0ff',
      glyph: '⚡',
    },
    spray: {
      id: 'spray',
      name: 'Spray',
      cost: 35,
      damage: 9,
      type: 'cone',
      aoe: 90,
      spread: 0.55,
      color: '#ff2da0',
      glyph: '✦',
    },
    shield: {
      id: 'shield',
      name: 'Shield',
      cost: 30,
      block: 22,
      duration: 4,
      type: 'shield',
      color: '#4d8cff',
      glyph: '◇',
    },
    dash: {
      id: 'dash',
      name: 'Dash',
      cost: 20,
      type: 'dash',
      iframe: 0.45,
      color: '#a0ff40',
      glyph: '»',
    },
    pulse: {
      id: 'pulse',
      name: 'Pulse',
      cost: 40,
      damage: 16,
      type: 'pulse',
      aoe: 105,
      color: '#ff7722',
      glyph: '◎',
    },
    nova: {
      id: 'nova',
      name: 'Nova',
      cost: 55,
      damage: 38,
      type: 'nova',
      aoe: 130,
      color: '#e040ff',
      glyph: '✸',
    },
    spike: {
      id: 'spike',
      name: 'Spike',
      cost: 30,
      damage: 20,
      type: 'projectile',
      speed: 640,
      pierce: true,
      color: '#ffe040',
      glyph: '▲',
    },
    drain: {
      id: 'drain',
      name: 'Drain',
      cost: 35,
      damage: 11,
      heal: 10,
      type: 'drain',
      color: '#30ffaa',
      glyph: '♥',
    },
  };

  const STARTER_DECK = [
    'bolt', 'bolt', 'spray', 'shield', 'dash', 'pulse', 'spike', 'drain', 'nova',
  ];

  const ATTACK_PATTERNS = [
  {
    id: 'slam',
    name: 'Slam',
    windup: 2.0,
    damage: 14,
    type: 'aoe',
    radius: 70,
    color: '#ff4466',
  },
  {
    id: 'swipe_left',
    name: 'Swipe',
    windup: 1.6,
    damage: 12,
    type: 'swipe',
    dir: -1,
    width: 120,
    color: '#ff8844',
  },
  {
    id: 'swipe_right',
    name: 'Swipe',
    windup: 1.6,
    damage: 12,
    type: 'swipe',
    dir: 1,
    width: 120,
    color: '#ff8844',
  },
  {
    id: 'beam',
    name: 'Beam',
    windup: 1.9,
    damage: 18,
    type: 'beam',
    width: 36,
    color: '#cc44ff',
  },
  {
    id: 'burst',
    name: 'Burst',
    windup: 1.1,
    damage: 9,
    type: 'aoe',
    radius: 55,
    color: '#ff2266',
  },
];

  function cardInstance(defId, uid) {
    return { uid, defId, ...CARD_DEFS[defId] };
  }

  function createEnemy(rng, phase) {
    const hp = phase >= 2 ? 280 : 220;
    return {
      id: 'sentinel',
      name: phase >= 2 ? 'Sentinel MK-II' : 'Sentinel',
      x: W * 0.5,
      y: H * 0.28,
      radius: 42,
      hp,
      maxHp: hp,
      phase,
      attack: null,
      attackCooldown: 1.2,
      hitFlash: 0,
      windShake: 0,
      alive: true,
    };
  }

  function createGame(seed) {
    const rng = createRng(seed || 42);
    const deck = rng.shuffle(STARTER_DECK.map((id, i) => cardInstance(id, 'c' + i)));
    return {
      seed: rng.seed,
      rng,
      w: W,
      h: H,
      phase: 'hint',
      time: 0,
      simTime: 0,
      paused: false,
      assistSlow: false,
      timeScale: 1,
      hitStop: 0,
      player: {
        x: W * 0.5,
        y: H * 0.62,
        radius: 28,
        hp: 100,
        maxHp: 100,
        shield: 0,
        shieldTimer: 0,
        energy: 50,
        maxEnergy: 100,
        energyRate: 18,
        iframe: 0,
        dodgeDir: 0,
        dodgeTimer: 0,
        hitFlash: 0,
      },
      flow: {
        multiplier: 1,
        score: 0,
        streak: 0,
        peak: 1,
      },
      hand: [],
      deck,
      discard: [],
      drawTimer: 0,
      drawInterval: 2.4,
      maxHand: 4,
      enemy: createEnemy(rng, 1),
      projectiles: [],
      effects: [],
      aiming: null,
      events: [],
      patternIndex: 0,
      dodgeWindow: null,
      stats: { hits: 0, dodges: 0, cardsPlayed: 0, damageDealt: 0 },
    };
  }

  function pushEvent(g, type, data) {
    g.events.push({ type, data, t: g.simTime });
  }

  function drawCard(g) {
    if (g.hand.length >= g.maxHand) return false;
    if (g.deck.length === 0) {
      if (g.discard.length === 0) return false;
      g.deck = g.rng.shuffle(g.discard);
      g.discard = [];
    }
    const card = g.deck.pop();
    g.hand.push(card);
    pushEvent(g, 'draw', { card });
    return true;
  }

  function flowBump(g, amount, reason) {
    const f = g.flow;
    f.streak += 1;
    const gain = amount * (1 + f.streak * 0.04);
    f.multiplier = Math.min(5, f.multiplier + gain);
    f.peak = Math.max(f.peak, f.multiplier);
    f.score += Math.floor(10 * f.multiplier);
    pushEvent(g, 'flow_up', { reason, multiplier: f.multiplier });
  }

  function flowDrop(g, amount, reason) {
    const f = g.flow;
    f.streak = 0;
    f.multiplier = Math.max(1, f.multiplier - amount);
    pushEvent(g, 'flow_down', { reason, multiplier: f.multiplier });
  }

  function effectiveDamage(g, base) {
    return Math.round(base * g.flow.multiplier);
  }

  function damageEnemy(g, enemy, amount, crit) {
    if (!enemy.alive) return;
    const dmg = effectiveDamage(g, amount);
    enemy.hp -= dmg;
    enemy.hitFlash = 0.2;
    enemy.windShake = crit ? 0.35 : 0.15;
    g.stats.damageDealt += dmg;
    g.stats.hits += 1;
    flowBump(g, crit ? 0.22 : 0.12, 'hit');
    pushEvent(g, 'enemy_hit', { damage: dmg, crit, x: enemy.x, y: enemy.y });
      if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.alive = false;
      pushEvent(g, 'enemy_defeated', { phase: enemy.phase });
    }
  }

  function damagePlayer(g, amount, source) {
    const p = g.player;
    if (p.iframe > 0) {
      flowBump(g, 0.18, 'dodge');
      g.stats.dodges += 1;
      pushEvent(g, 'dodge', { source });
      return;
    }
    let remaining = amount;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, remaining);
      p.shield -= absorbed;
      remaining -= absorbed;
      pushEvent(g, 'shield_hit', { absorbed });
    }
    if (remaining > 0) {
      p.hp -= remaining;
      p.hitFlash = 0.35;
      flowDrop(g, 0.55, 'hit');
      pushEvent(g, 'player_hit', { damage: remaining, source });
      g.hitStop = 0.08;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      g.phase = 'lost';
      pushEvent(g, 'defeat', {});
    }
  }

  function startFight(g) {
    g.phase = 'playing';
    g.hand = [];
    for (let i = 0; i < 3; i++) drawCard(g);
    g.enemy.attackCooldown = 2.0;
    pushEvent(g, 'fight_start', {});
  }

  function resetGame(g, seed) {
    const fresh = createGame(seed != null ? seed : g.seed);
    fresh.assistSlow = g.assistSlow;
    Object.assign(g, fresh);
    startFight(g);
    return g;
  }

  function pickNextAttack(g, enemy) {
    const patterns = ATTACK_PATTERNS.slice();
    const phase = enemy.phase;
    let pool = patterns;
    if (phase === 1) {
      pool = patterns.filter((p) => p.id !== 'burst');
    }
    const pat = pool[g.patternIndex % pool.length];
    g.patternIndex += 1;
    const slow = g.assistSlow ? 1.35 : 1;
    const phaseMul = phase >= 2 ? 0.82 : 1;
    return {
      ...pat,
      progress: 0,
      windup: pat.windup * slow * phaseMul,
      active: true,
      resolved: false,
    };
  }

  function resolveAttack(g, atk) {
    if (atk.resolved) return;
    atk.resolved = true;
    const p = g.player;
    const e = g.enemy;
    pushEvent(g, 'attack_fire', { attack: atk.id });

    if (atk.type === 'aoe') {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < atk.radius + p.radius) {
        damagePlayer(g, atk.damage, atk.id);
      } else {
        flowBump(g, 0.1, 'avoid');
      }
    } else if (atk.type === 'swipe') {
      g.dodgeWindow = { dir: atk.dir, timer: 0.35, attack: atk.id };
      const needed = atk.dir;
      if (p.dodgeDir === needed && p.dodgeTimer > 0) {
        flowBump(g, 0.2, 'dodge');
        g.stats.dodges += 1;
        pushEvent(g, 'dodge', { source: atk.id });
      } else {
        damagePlayer(g, atk.damage, atk.id);
      }
    } else if (atk.type === 'beam') {
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const px = p.x - e.x;
      const py = p.y - e.y;
      const along = px * nx + py * ny;
      const perp = Math.abs(px * -ny + py * nx);
      if (along > 0 && perp < atk.width + p.radius) {
        damagePlayer(g, atk.damage, atk.id);
      } else {
        flowBump(g, 0.1, 'avoid');
      }
    }
  }

  function spawnProjectile(g, card, tx, ty) {
    const p = g.player;
    const angle = Math.atan2(ty - p.y, tx - p.x);
    g.projectiles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * (card.speed || 500),
      vy: Math.sin(angle) * (card.speed || 500),
      damage: card.damage,
      color: card.color,
      radius: 8,
      pierce: !!card.pierce,
      type: 'player',
      cardId: card.id,
      life: 2,
    });
    pushEvent(g, 'fire', { card: card.id, x: p.x, y: p.y });
  }

  function applyCone(g, card, tx, ty) {
    const p = g.player;
    const e = g.enemy;
    const angle = Math.atan2(ty - p.y, tx - p.x);
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const dist = Math.hypot(dx, dy);
    const aToE = Math.atan2(dy, dx);
    let diff = Math.abs(Math.atan2(Math.sin(aToE - angle), Math.cos(aToE - angle)));
    if (dist < card.aoe && diff < card.spread) {
      damageEnemy(g, e, card.damage, diff < 0.15);
    } else {
      flowDrop(g, 0.15, 'whiff');
      pushEvent(g, 'whiff', { card: card.id });
    }
    pushEvent(g, 'cone', { x: p.x, y: p.y, angle, aoe: card.aoe, color: card.color });
  }

  function applyPulse(g, card) {
    const p = g.player;
    const e = g.enemy;
    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    pushEvent(g, 'pulse_wave', { x: p.x, y: p.y, aoe: card.aoe, color: card.color });
    if (dist < card.aoe + e.radius) {
      damageEnemy(g, e, card.damage, dist < card.aoe * 0.5);
    }
  }

  function applyNova(g, card, tx, ty) {
    const e = g.enemy;
    const dist = Math.hypot(e.x - tx, e.y - ty);
    pushEvent(g, 'nova', { x: tx, y: ty, aoe: card.aoe, color: card.color });
    if (dist < card.aoe + e.radius) {
      damageEnemy(g, e, card.damage, true);
      g.hitStop = 0.12;
    } else {
      flowDrop(g, 0.2, 'whiff');
    }
  }

  function applyDrain(g, card) {
    const e = g.enemy;
    const dist = Math.hypot(e.x - g.player.x, e.y - g.player.y);
    if (dist < 160) {
      damageEnemy(g, e, card.damage, false);
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + card.heal);
      pushEvent(g, 'drain', { heal: card.heal });
    } else {
      flowDrop(g, 0.15, 'whiff');
    }
  }

  function playCard(g, handIndex, tx, ty) {
    const card = g.hand[handIndex];
    if (!card) return false;
    if (g.player.energy < card.cost) {
      pushEvent(g, 'no_energy', {});
      return false;
    }
    g.player.energy -= card.cost;
    g.hand.splice(handIndex, 1);
    g.discard.push(card);
    g.stats.cardsPlayed += 1;

    const type = card.type;
    if (type === 'projectile') {
      spawnProjectile(g, card, tx, ty);
    } else if (type === 'cone') {
      applyCone(g, card, tx, ty);
    } else if (type === 'shield') {
      g.player.shield = card.block;
      g.player.shieldTimer = card.duration;
      pushEvent(g, 'shield', { block: card.block });
      flowBump(g, 0.08, 'shield');
    } else if (type === 'dash') {
      const dx = tx - g.player.x;
      g.player.dodgeDir = dx < 0 ? -1 : 1;
      g.player.dodgeTimer = card.iframe;
      g.player.iframe = card.iframe;
      const move = Math.sign(dx) * 90;
      g.player.x = Math.max(40, Math.min(W - 40, g.player.x + move));
      pushEvent(g, 'dash', { dir: g.player.dodgeDir });
      flowBump(g, 0.1, 'dash');
    } else if (type === 'pulse') {
      applyPulse(g, card);
    } else if (type === 'nova') {
      applyNova(g, card, tx, ty);
    } else if (type === 'drain') {
      applyDrain(g, card);
    }

    return true;
  }

  function previewCard(g, card, tx, ty) {
    const p = g.player;
    const e = g.enemy;
    const prev = {
      card,
      tx,
      ty,
      damage: effectiveDamage(g, card.damage || 0),
      block: card.block || 0,
      shapes: [],
    };

    if (card.type === 'projectile' || card.type === 'drain') {
      prev.shapes.push({
        kind: 'line',
        x1: p.x,
        y1: p.y,
        x2: tx,
        y2: ty,
        color: card.color,
      });
      const dist = Math.hypot(e.x - tx, e.y - ty);
      if (card.type === 'drain') {
        prev.shapes.push({ kind: 'circle', x: p.x, y: p.y, r: 160, color: card.color, alpha: 0.25 });
      } else {
        prev.shapes.push({ kind: 'circle', x: e.x, y: e.y, r: e.radius + 12, color: card.color, alpha: 0.4 });
        prev.willHit = dist < 80;
      }
    } else if (card.type === 'cone') {
      const angle = Math.atan2(ty - p.y, tx - p.x);
      prev.shapes.push({ kind: 'cone', x: p.x, y: p.y, angle, spread: card.spread, r: card.aoe, color: card.color });
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      const aToE = Math.atan2(dy, dx);
      let diff = Math.abs(Math.atan2(Math.sin(aToE - angle), Math.cos(aToE - angle)));
      prev.willHit = dist < card.aoe && diff < card.spread;
    } else if (card.type === 'pulse') {
      prev.shapes.push({ kind: 'circle', x: p.x, y: p.y, r: card.aoe, color: card.color, alpha: 0.35 });
      prev.willHit = Math.hypot(e.x - p.x, e.y - p.y) < card.aoe + e.radius;
    } else if (card.type === 'nova') {
      prev.shapes.push({ kind: 'circle', x: tx, y: ty, r: card.aoe, color: card.color, alpha: 0.4 });
      prev.willHit = Math.hypot(e.x - tx, e.y - ty) < card.aoe + e.radius;
    } else if (card.type === 'shield') {
      prev.shapes.push({ kind: 'ring', x: p.x, y: p.y, r: p.radius + 18, color: card.color, alpha: 0.5 });
    } else if (card.type === 'dash') {
      const dir = tx < p.x ? -1 : 1;
      prev.shapes.push({ kind: 'dash', x: p.x, y: p.y, dir, color: card.color });
    }
    return prev;
  }

  function step(g, dt) {
    if (g.paused || g.phase === 'won' || g.phase === 'lost' || g.phase === 'hint') return;

    if (g.hitStop > 0) {
      g.hitStop -= dt;
      return;
    }

    const scale = g.aiming && g.aiming.dilated ? 0.12 : g.timeScale;
    const sdt = dt * scale;
    g.simTime += sdt;
    g.time += dt;

    const p = g.player;
    const e = g.enemy;

    p.energy = Math.min(p.maxEnergy, p.energy + p.energyRate * sdt);
    if (p.shieldTimer > 0) {
      p.shieldTimer -= sdt;
      if (p.shieldTimer <= 0) p.shield = 0;
    }
    if (p.iframe > 0) p.iframe -= sdt;
    if (p.dodgeTimer > 0) p.dodgeTimer -= sdt;
    if (p.hitFlash > 0) p.hitFlash -= sdt;
    if (e.hitFlash > 0) e.hitFlash -= sdt;
    if (e.windShake > 0) e.windShake -= sdt;

    g.drawTimer += sdt;
    if (g.drawTimer >= g.drawInterval) {
      g.drawTimer = 0;
      drawCard(g);
    }

    if (e.alive) {
      if (e.attack) {
        e.attack.progress += sdt / e.attack.windup;
        if (e.attack.progress >= 1 && !e.attack.resolved) {
          resolveAttack(g, e.attack);
          e.attack = null;
          e.attackCooldown = e.phase >= 2 ? 0.9 : 1.4;
        }
      } else {
        e.attackCooldown -= sdt;
        if (e.attackCooldown <= 0) {
          e.attack = pickNextAttack(g, e);
        }
      }
    } else if (e.phase === 1 && g.phase === 'playing') {
      e.phase = 2;
      const next = createEnemy(g.rng, 2);
      next.x = e.x;
      next.y = e.y;
      g.enemy = next;
      g.enemy.attackCooldown = 1.5;
      pushEvent(g, 'phase2', {});
    } else if (!e.alive && e.phase === 2) {
      g.phase = 'won';
      g.flow.score += Math.floor(200 * g.flow.peak);
      pushEvent(g, 'victory', { score: g.flow.score });
    }

    for (let i = g.projectiles.length - 1; i >= 0; i--) {
      const pr = g.projectiles[i];
      pr.x += pr.vx * sdt;
      pr.y += pr.vy * sdt;
      pr.life -= sdt;
      if (e.alive) {
        const d = Math.hypot(pr.x - e.x, pr.y - e.y);
        if (d < e.radius + pr.radius) {
          damageEnemy(g, e, pr.damage, pr.cardId === 'spike');
          pushEvent(g, 'projectile_hit', { x: pr.x, y: pr.y, color: pr.color });
          if (!pr.pierce) {
            g.projectiles.splice(i, 1);
            continue;
          }
        }
      }
      if (pr.life <= 0 || pr.x < -20 || pr.x > W + 20 || pr.y < -20 || pr.y > H + 20) {
        g.projectiles.splice(i, 1);
      }
    }

    if (g.dodgeWindow) {
      g.dodgeWindow.timer -= sdt;
      if (g.dodgeWindow.timer <= 0) g.dodgeWindow = null;
    }
  }

  function getTimeScale(g) {
    if (g.aiming && g.aiming.dilated) return 0.12;
    return g.timeScale;
  }

  function drainEvents(g) {
    const ev = g.events.slice();
    g.events.length = 0;
    return ev;
  }

  function playerDodge(g, dir) {
    if (g.phase !== 'playing') return;
    const p = g.player;
    p.dodgeDir = dir;
    p.dodgeTimer = 0.4;
    p.iframe = 0.28;
    p.x = Math.max(40, Math.min(W - 40, p.x + dir * 70));
    pushEvent(g, 'swipe_dodge', { dir });
  }

  const PulseEngine = {
    W,
    H,
    CARD_DEFS,
    createGame,
    startFight,
    resetGame,
    step,
    drawCard,
    playCard,
    previewCard,
    playerDodge,
    getTimeScale,
    drainEvents,
    effectiveDamage,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PulseEngine;
  } else {
    global.PulseEngine = PulseEngine;
  }
})(typeof window !== 'undefined' ? window : global);
