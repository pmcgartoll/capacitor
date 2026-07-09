/**
 * Pulse — deterministic game logic (renderer-agnostic)
 *
 * Architecture: "zones as shared data".
 * Every attack — enemy pattern or player card — declares its hit area as a
 * Shape. The SAME shape object is used to (1) draw the telegraph/preview,
 * (2) answer "will this hit?", and (3) resolve damage. Telegraphs therefore
 * cannot lie: what you see is exactly the hitbox that resolves.
 *
 * Enemy attacks track the player during windup, then LOCK at a fixed point
 * (lockAt fraction of windup). After the lock the zone is frozen, giving a
 * real window where moving out of the zone dodges the attack.
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

  // ── Shapes: plain data + one shared overlap test ──────────────────────────

  const Shape = {
    circle(x, y, r) {
      return { kind: 'circle', x, y, r };
    },
    // Full-height vertical strip centered on x (player only moves in x).
    band(x, halfW) {
      return { kind: 'band', x, halfW };
    },
    // Thick line segment.
    beam(x1, y1, x2, y2, halfW) {
      return { kind: 'beam', x1, y1, x2, y2, halfW };
    },
    cone(x, y, angle, spread, r) {
      return { kind: 'cone', x, y, angle, spread, r };
    },
  };

  function circleOverlaps(shape, cx, cy, cr) {
    if (!shape) return false;
    switch (shape.kind) {
      case 'circle':
        return Math.hypot(cx - shape.x, cy - shape.y) < shape.r + cr;
      case 'band':
        return Math.abs(cx - shape.x) < shape.halfW + cr;
      case 'beam': {
        const dx = shape.x2 - shape.x1;
        const dy = shape.y2 - shape.y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((cx - shape.x1) * dx + (cy - shape.y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = shape.x1 + t * dx;
        const py = shape.y1 + t * dy;
        return Math.hypot(cx - px, cy - py) < shape.halfW + cr;
      }
      case 'cone': {
        const dist = Math.hypot(cx - shape.x, cy - shape.y);
        if (dist >= shape.r + cr) return false;
        const a = Math.atan2(cy - shape.y, cx - shape.x);
        const diff = Math.abs(Math.atan2(Math.sin(a - shape.angle), Math.cos(a - shape.angle)));
        // Widen by the angular radius the target circle subtends, so a cone
        // grazing the edge of the enemy counts the same as the drawn wedge.
        const slack = dist > 0.001 ? Math.asin(Math.min(1, cr / dist)) : Math.PI;
        return diff < shape.spread + slack;
      }
      default:
        return false;
    }
  }

  // Does a ray from (x1,y1) toward (x2,y2) pass within r of (cx,cy)?
  function rayHitsCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return Math.hypot(cx - x1, cy - y1) < r;
    const nx = dx / len;
    const ny = dy / len;
    const along = (cx - x1) * nx + (cy - y1) * ny;
    if (along < 0) return false;
    const perp = Math.abs((cx - x1) * -ny + (cy - y1) * nx);
    return perp < r;
  }

  // ── Cards ──────────────────────────────────────────────────────────────────
  // Dash was removed: swiping is the single movement/dodge verb, so a card
  // that duplicated it only muddied the controls.

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
      // Long enough to reach the enemy (~287 units away) — the old 90 radius
      // could never connect from the player's position.
      aoe: 340,
      spread: 0.38,
      whiffPenalty: 0.15,
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
    pulse: {
      id: 'pulse',
      name: 'Pulse',
      cost: 40,
      damage: 16,
      type: 'pulse',
      aoe: 105,
      leash: 300,
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
      whiffPenalty: 0.2,
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
      aoe: 80,
      leash: 320,
      type: 'drain',
      whiffPenalty: 0.15,
      color: '#30ffaa',
      glyph: '♥',
    },
  };

  const STARTER_DECK = [
    'bolt', 'bolt', 'spray', 'shield', 'pulse', 'spike', 'drain', 'nova',
  ];

  // ── Enemy attack patterns ──────────────────────────────────────────────────
  // zone(g) builds the hit shape from current game state. It is re-evaluated
  // every step until the attack locks (progress >= lockAt), then frozen.
  // hint: what escapes it — shown by the renderer.

  const ATTACK_PATTERNS = [
    {
      id: 'slam',
      name: 'Slam',
      windup: 2.0,
      lockAt: 0.6,
      damage: 14,
      color: '#ff4466',
      hint: 'move',
      zone: (g) => Shape.circle(g.player.x, g.player.y, 70),
    },
    {
      id: 'swipe_left',
      name: 'Claw',
      windup: 1.6,
      lockAt: 0.55,
      damage: 12,
      color: '#ff8844',
      hint: 'move',
      zone: (g) => Shape.band(g.player.x, 55),
    },
    {
      id: 'swipe_right',
      name: 'Claw',
      windup: 1.6,
      lockAt: 0.55,
      damage: 12,
      color: '#ff8844',
      hint: 'move',
      zone: (g) => Shape.band(g.player.x, 55),
    },
    {
      id: 'beam',
      name: 'Beam',
      windup: 1.9,
      lockAt: 0.7,
      damage: 18,
      color: '#cc44ff',
      hint: 'move',
      zone: (g) => {
        const e = g.enemy;
        const p = g.player;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        // Extend the beam through the player to the arena edge.
        const reach = 1200;
        return Shape.beam(e.x, e.y, e.x + (dx / len) * reach, e.y + (dy / len) * reach, 18);
      },
    },
    {
      id: 'burst',
      name: 'Burst',
      windup: 1.1,
      lockAt: 0.5,
      damage: 9,
      color: '#ff2266',
      hint: 'move',
      zone: (g) => Shape.circle(g.player.x, g.player.y, 55),
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
      aiming: null,
      events: [],
      patternIndex: 0,
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

  // ── Enemy attacks: track → lock → resolve ─────────────────────────────────

  function pickNextAttack(g, enemy) {
    let pool = ATTACK_PATTERNS;
    if (enemy.phase === 1) {
      pool = pool.filter((p) => p.id !== 'burst');
    }
    const def = pool[g.patternIndex % pool.length];
    g.patternIndex += 1;
    const slow = g.assistSlow ? 1.35 : 1;
    const phaseMul = enemy.phase >= 2 ? 0.82 : 1;
    return {
      def,
      id: def.id,
      name: def.name,
      damage: def.damage,
      color: def.color,
      hint: def.hint,
      windup: def.windup * slow * phaseMul,
      progress: 0,
      locked: false,
      zone: def.zone(g),
      active: true,
    };
  }

  function stepAttack(g, atk, sdt) {
    atk.progress += sdt / atk.windup;
    if (!atk.locked) {
      if (atk.progress >= atk.def.lockAt) {
        atk.locked = true;
        pushEvent(g, 'attack_lock', { id: atk.id });
      } else {
        atk.zone = atk.def.zone(g);
      }
    }
    if (atk.progress >= 1) {
      resolveAttack(g, atk);
      return true;
    }
    return false;
  }

  function resolveAttack(g, atk) {
    const p = g.player;
    pushEvent(g, 'attack_fire', { attack: atk.id, zone: atk.zone, color: atk.color });
    // One rule for every attack: are you inside the telegraphed zone?
    if (circleOverlaps(atk.zone, p.x, p.y, p.radius)) {
      damagePlayer(g, atk.damage, atk.id);
    } else {
      flowBump(g, 0.12, 'dodge');
      g.stats.dodges += 1;
      pushEvent(g, 'dodge', { source: atk.id });
    }
  }

  // ── Cards: one outcome function feeds preview AND resolution ──────────────

  // Clamp an aim point to within `leash` of the player (aimed AoE cards).
  function leashPoint(p, tx, ty, leash) {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= leash) return { x: tx, y: ty };
    return { x: p.x + (dx / d) * leash, y: p.y + (dy / d) * leash };
  }

  function cardOutcome(g, card, tx, ty) {
    const p = g.player;
    const e = g.enemy;
    const out = {
      card,
      tx,
      ty,
      damage: effectiveDamage(g, card.damage || 0),
      block: card.block || 0,
      heal: card.heal || 0,
      zone: null,
      aimLine: null,
      willHit: false,
    };

    switch (card.type) {
      case 'projectile':
        out.aimLine = { x1: p.x, y1: p.y, x2: tx, y2: ty };
        out.willHit = e.alive && rayHitsCircle(p.x, p.y, tx, ty, e.x, e.y, e.radius + 8);
        break;
      case 'cone':
        out.zone = Shape.cone(p.x, p.y, Math.atan2(ty - p.y, tx - p.x), card.spread, card.aoe);
        out.willHit = e.alive && circleOverlaps(out.zone, e.x, e.y, e.radius);
        break;
      case 'pulse':
      case 'drain': {
        const c = leashPoint(p, tx, ty, card.leash);
        out.zone = Shape.circle(c.x, c.y, card.aoe);
        out.leash = { x: p.x, y: p.y, r: card.leash };
        out.willHit = e.alive && circleOverlaps(out.zone, e.x, e.y, e.radius);
        break;
      }
      case 'nova':
        out.zone = Shape.circle(tx, ty, card.aoe);
        out.willHit = e.alive && circleOverlaps(out.zone, e.x, e.y, e.radius);
        break;
      case 'shield':
        break;
      default:
        break;
    }
    return out;
  }

  // Preview is the outcome, verbatim — no separate geometry to drift.
  function previewCard(g, card, tx, ty) {
    return cardOutcome(g, card, tx, ty);
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
    pushEvent(g, 'fire', { card: card.id, x: p.x, y: p.y, color: card.color });
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

    const out = cardOutcome(g, card, tx, ty);

    if (card.type === 'projectile') {
      spawnProjectile(g, card, tx, ty);
    } else if (card.type === 'shield') {
      g.player.shield = card.block;
      g.player.shieldTimer = card.duration;
      pushEvent(g, 'shield', { block: card.block });
      flowBump(g, 0.08, 'shield');
    } else {
      // Zone cards resolve exactly what the preview showed.
      pushEvent(g, 'zone_cast', {
        card: card.id,
        type: card.type,
        zone: out.zone,
        color: card.color,
        x: out.zone.x,
        y: out.zone.y,
      });
      if (out.willHit) {
        const e = g.enemy;
        const crit = card.type === 'nova'
          || (card.type === 'pulse' && Math.hypot(e.x - out.zone.x, e.y - out.zone.y) < card.aoe * 0.5);
        damageEnemy(g, e, card.damage, crit);
        if (card.type === 'nova') g.hitStop = 0.12;
        if (card.heal) {
          g.player.hp = Math.min(g.player.maxHp, g.player.hp + card.heal);
          pushEvent(g, 'drain', { heal: card.heal });
        }
      } else if (card.whiffPenalty) {
        flowDrop(g, card.whiffPenalty, 'whiff');
        pushEvent(g, 'whiff', { card: card.id });
      }
    }
    return true;
  }

  // ── Simulation step ────────────────────────────────────────────────────────

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
        const done = stepAttack(g, e.attack, sdt);
        if (done) {
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

  // Swipe: the one movement/dodge verb. Move laterally + brief i-frames.
  function playerDodge(g, dir) {
    if (g.phase !== 'playing') return;
    const p = g.player;
    p.iframe = 0.28;
    p.x = Math.max(40, Math.min(W - 40, p.x + dir * 70));
    pushEvent(g, 'swipe_dodge', { dir });
  }

  const PulseEngine = {
    W,
    H,
    CARD_DEFS,
    ATTACK_PATTERNS,
    Shape,
    circleOverlaps,
    rayHitsCircle,
    createGame,
    startFight,
    resetGame,
    step,
    drawCard,
    playCard,
    previewCard,
    cardOutcome,
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
