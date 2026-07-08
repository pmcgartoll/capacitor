/**
 * Tideturn — deterministic combat engine (pure functions, no DOM).
 * Preview is produced by running the same resolver on a cloned state.
 */

(function (global) {
  'use strict';

  // ── Seeded RNG (mulberry32) ──────────────────────────────────────────────

  function createRng(seed) {
    let s = seed >>> 0;
    return {
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

  // ── Card definitions ─────────────────────────────────────────────────────

  const CARDS = {
    strike: {
      id: 'strike',
      name: 'Strike',
      cost: 1,
      keywords: ['Attack'],
      text: 'Deal 6 damage to one enemy.',
      needsTarget: 'enemy',
      soloPreview: '−6 HP on target',
    },
    cleave: {
      id: 'cleave',
      name: 'Cleave',
      cost: 1,
      keywords: ['Attack', 'Lane'],
      text: 'Deal 4 damage to every enemy in a lane.',
      needsTarget: 'lane',
      soloPreview: '−4 HP to all in lane',
    },
    guard: {
      id: 'guard',
      name: 'Guard',
      cost: 1,
      keywords: ['Block'],
      text: 'Gain 5 Block.',
      needsTarget: null,
      soloPreview: '+5 Block',
    },
    twin_strike: {
      id: 'twin_strike',
      name: 'Twin Strike',
      cost: 2,
      keywords: ['Attack'],
      text: 'Deal 4 damage twice to one enemy.',
      needsTarget: 'enemy',
      soloPreview: '−4 HP ×2 on target',
    },
    undertow: {
      id: 'undertow',
      name: 'Undertow',
      cost: 1,
      keywords: ['Debuff'],
      text: 'Reduce target\'s next attack by 3.',
      needsTarget: 'enemy',
      soloPreview: 'Next attack −3',
    },
    push: {
      id: 'push',
      name: 'Push',
      cost: 1,
      keywords: ['Move'],
      text: 'Shove an enemy to an adjacent lane.',
      needsTarget: 'enemy',
      soloPreview: 'Moves enemy one lane',
    },
    surge: {
      id: 'surge',
      name: 'Surge',
      cost: 0,
      keywords: ['Energy', 'Draw'],
      text: 'Gain 1 Energy. Draw 1 card.',
      needsTarget: null,
      soloPreview: '+1 Energy, draw 1',
    },
    tsunami: {
      id: 'tsunami',
      name: 'Tsunami',
      cost: 3,
      keywords: ['Attack'],
      text: 'Deal 12 damage to one enemy.',
      needsTarget: 'enemy',
      soloPreview: '−12 HP on target',
    },
  };

  const GLOSSARY = {
    Attack: 'Deals damage to enemies. Block absorbs damage first.',
    Block: 'Absorbs incoming damage until end of next enemy phase.',
    Lane: 'A vertical column on the board. Cleave hits all enemies there.',
    Debuff: 'Weakens an enemy for their next action.',
    Move: 'Repositions an enemy on the board.',
    Energy: 'Spent to play cards. Refills each turn.',
    Draw: 'Take cards from your deck into your hand.',
  };

  const STARTER_DECK = [
    'strike', 'strike', 'strike',
    'guard', 'guard',
    'cleave',
    'undertow',
    'push',
    'surge',
    'twin_strike',
    'tsunami',
  ];

  const INTENT_TYPES = {
    attack_player: { icon: '⚔', label: 'Attack' },
    defend: { icon: '🛡', label: 'Defend' },
    charge: { icon: '⚡', label: 'Charge' },
  };

  // ── State helpers ────────────────────────────────────────────────────────

  let _nextId = 1;
  function uid() {
    return _nextId++;
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function livingEnemies(state) {
    return state.enemies.filter((e) => e.hp > 0);
  }

  function getEnemy(state, id) {
    return state.enemies.find((e) => e.id === id);
  }

  function enemiesInLane(state, lane) {
    return state.enemies.filter((e) => e.hp > 0 && e.lane === lane);
  }

  function dealDamageToEnemy(state, enemyId, amount) {
    const e = getEnemy(state, enemyId);
    if (!e || e.hp <= 0) return 0;
    const dealt = Math.min(amount, e.hp);
    e.hp -= dealt;
    return dealt;
  }

  function drawCards(state, count, rng) {
    for (let i = 0; i < count; i++) {
      if (state.deck.length === 0) {
        if (state.discard.length === 0) break;
        state.deck = rng.shuffle(state.discard);
        state.discard = [];
      }
      if (state.deck.length === 0) break;
      const cardId = state.deck.pop();
      state.hand.push({ uid: uid(), cardId });
    }
  }

  function createCardInstance(cardId) {
    return { uid: uid(), cardId };
  }

  // ── Enemy intents ────────────────────────────────────────────────────────

  function rollEnemyIntent(enemy, rng) {
    const roll = rng.next();
    if (enemy.name === 'Tide Crawler') {
      return { type: 'attack_player', value: 5, targetLane: null };
    }
    if (enemy.name === 'Brine Guard') {
      return roll < 0.3
        ? { type: 'defend', value: 6, targetLane: null }
        : { type: 'attack_player', value: 8, targetLane: enemy.lane };
    }
    if (enemy.name === 'Deep Wraith') {
      return roll < 0.25
        ? { type: 'charge', value: 4, targetLane: null }
        : { type: 'attack_player', value: 10, targetLane: enemy.lane };
    }
    return { type: 'attack_player', value: 4, targetLane: null };
  }

  function assignEnemyIntents(state, rng) {
    for (const e of state.enemies) {
      if (e.hp > 0) {
        if (e.chargedBonus) {
          e.intent = { type: 'attack_player', value: e.chargedBonus, targetLane: e.lane };
          e.chargedBonus = 0;
        } else {
          e.intent = rollEnemyIntent(e, rng);
        }
      }
    }
  }

  // ── Initial battle ───────────────────────────────────────────────────────

  function createInitialState(seed) {
    _nextId = 1;
    const rng = createRng(seed);
    const deck = rng.shuffle(STARTER_DECK.slice());

    const state = {
      seed,
      turn: 1,
      phase: 'plan',
      player: { hp: 40, maxHp: 40, block: 0, energy: 3, maxEnergy: 3 },
      enemies: [
        {
          id: uid(),
          name: 'Tide Crawler',
          lane: 0,
          hp: 14,
          maxHp: 14,
          block: 0,
          attackReduction: 0,
          turnOrder: 1,
          intent: null,
        },
        {
          id: uid(),
          name: 'Brine Guard',
          lane: 1,
          hp: 18,
          maxHp: 18,
          block: 0,
          attackReduction: 0,
          turnOrder: 2,
          intent: null,
        },
        {
          id: uid(),
          name: 'Deep Wraith',
          lane: 2,
          hp: 16,
          maxHp: 16,
          block: 0,
          attackReduction: 0,
          turnOrder: 3,
          intent: null,
        },
      ],
      hand: [],
      deck,
      discard: [],
      staged: [],
      log: [],
    };

    assignEnemyIntents(state, rng);
    drawCards(state, 5, rng);
    return state;
  }

  // ── Card resolution (pure on cloned state) ───────────────────────────────

  function applyCard(state, cardId, target, rng) {
    const card = CARDS[cardId];
    if (!card) return { events: [] };
    const events = [];

    switch (cardId) {
      case 'strike': {
        const dealt = dealDamageToEnemy(state, target.enemyId, 6);
        events.push({ type: 'damage', enemyId: target.enemyId, amount: dealt });
        break;
      }
      case 'cleave': {
        const lane = target.lane;
        for (const e of enemiesInLane(state, lane)) {
          const dealt = dealDamageToEnemy(state, e.id, 4);
          events.push({ type: 'damage', enemyId: e.id, amount: dealt });
        }
        break;
      }
      case 'guard': {
        state.player.block += 5;
        events.push({ type: 'block', amount: 5 });
        break;
      }
      case 'twin_strike': {
        for (let i = 0; i < 2; i++) {
          const dealt = dealDamageToEnemy(state, target.enemyId, 4);
          events.push({ type: 'damage', enemyId: target.enemyId, amount: dealt });
        }
        break;
      }
      case 'undertow': {
        const e = getEnemy(state, target.enemyId);
        if (e) {
          e.attackReduction = (e.attackReduction || 0) + 3;
          events.push({ type: 'debuff', enemyId: e.id, amount: 3 });
        }
        break;
      }
      case 'push': {
        const e = getEnemy(state, target.enemyId);
        if (e) {
          const dir = target.direction || 1;
          const newLane = Math.max(0, Math.min(2, e.lane + dir));
          const oldLane = e.lane;
          e.lane = newLane;
          events.push({ type: 'push', enemyId: e.id, from: oldLane, to: newLane });
        }
        break;
      }
      case 'surge': {
        state.player.energy += 1;
        drawCards(state, 1, rng);
        events.push({ type: 'energy', amount: 1 });
        events.push({ type: 'draw', amount: 1 });
        break;
      }
      case 'tsunami': {
        const dealt = dealDamageToEnemy(state, target.enemyId, 12);
        events.push({ type: 'damage', enemyId: target.enemyId, amount: dealt });
        break;
      }
      default:
        break;
    }
    return { events };
  }

  function resolveStagedTurn(state, staged, rng) {
    const allEvents = [];
    for (const action of staged) {
      const cardInst = state.hand.find((c) => c.uid === action.cardUid);
      if (!cardInst) continue;
      const card = CARDS[cardInst.cardId];
      if (!card) continue;
      if (state.player.energy < card.cost) continue;

      state.player.energy -= card.cost;
      const result = applyCard(state, cardInst.cardId, action.target || {}, rng);
      allEvents.push(...result.events.map((e) => ({ ...e, cardUid: cardInst.uid })));

      state.hand = state.hand.filter((c) => c.uid !== cardInst.uid);
      state.discard.push(cardInst.cardId);
    }
    state.staged = [];
    return allEvents;
  }

  function resolveEnemyPhase(state) {
    const events = [];
    const sorted = livingEnemies(state).slice().sort((a, b) => a.turnOrder - b.turnOrder);

    for (const enemy of sorted) {
      if (enemy.hp <= 0) continue;
      const intent = enemy.intent;
      if (!intent) continue;

      if (intent.type === 'defend') {
        enemy.block += intent.value;
        events.push({ type: 'enemy_defend', enemyId: enemy.id, amount: intent.value });
      } else if (intent.type === 'charge') {
        enemy.chargedBonus = (enemy.chargedBonus || 0) + intent.value;
        events.push({ type: 'enemy_charge', enemyId: enemy.id, amount: intent.value });
      } else if (intent.type === 'attack_player') {
        let dmg = intent.value;
        const reduction = enemy.attackReduction || 0;
        if (reduction > 0) {
          const reduced = Math.min(reduction, dmg);
          dmg -= reduced;
          enemy.attackReduction -= reduced;
          events.push({ type: 'debuff_consumed', enemyId: enemy.id, amount: reduced });
        }
        let remaining = dmg;
        if (state.player.block > 0) {
          const blocked = Math.min(state.player.block, remaining);
          state.player.block -= blocked;
          remaining -= blocked;
          events.push({ type: 'block_absorb', amount: blocked });
        }
        if (remaining > 0) {
          state.player.hp -= remaining;
          events.push({ type: 'player_damage', amount: remaining, fromEnemy: enemy.id });
        }
        events.push({ type: 'enemy_attack', enemyId: enemy.id, amount: dmg, lane: intent.targetLane });
      }
    }
    return events;
  }

  function startNewTurn(state, rng) {
    state.turn += 1;
    state.player.energy = state.player.maxEnergy;
    state.player.block = 0;
    drawCards(state, Math.max(0, 5 - state.hand.length), rng);
    assignEnemyIntents(state, rng);
    state.phase = 'plan';
  }

  // ── Preview (same resolver, cloned state) ────────────────────────────────

  function computePreview(baseState, staged) {
    const rng = createRng(baseState.seed + baseState.turn * 997 + staged.length * 13);
    const state = cloneState(baseState);
    state.staged = staged.map((s) => ({ ...s, target: s.target ? { ...s.target } : null }));

    // Simulate energy spend validation
    let energy = state.player.energy;
    const validStaged = [];
    for (const action of staged) {
      const cardInst = state.hand.find((c) => c.uid === action.cardUid);
      if (!cardInst) continue;
      const card = CARDS[cardInst.cardId];
      if (!card || energy < card.cost) continue;
      energy -= card.cost;
      validStaged.push(action);
    }

    resolveStagedTurn(state, validStaged, rng);

    const incoming = calculateIncomingDamage(state);

    return {
      state,
      validStaged,
      projectedPlayer: { ...state.player },
      projectedEnemies: state.enemies.map((e) => ({
        id: e.id,
        hp: e.hp,
        maxHp: e.maxHp,
        lane: e.lane,
        dead: e.hp <= 0,
        block: e.block,
        attackReduction: e.attackReduction,
      })),
      incomingDamage: incoming.total,
      incomingBreakdown: incoming.breakdown,
      energyRemaining: energy,
    };
  }

  function calculateIncomingDamage(state) {
    const breakdown = [];
    let total = 0;
    const sorted = livingEnemies(state).slice().sort((a, b) => a.turnOrder - b.turnOrder);

    let simBlock = state.player.block;

    for (const enemy of sorted) {
      const intent = enemy.intent;
      if (!intent || intent.type !== 'attack_player') continue;
      let dmg = intent.value;
      const reduction = enemy.attackReduction || 0;
      if (reduction > 0) {
        dmg = Math.max(0, dmg - Math.min(reduction, dmg));
      }
      let hpDmg = dmg;
      if (simBlock > 0) {
        const blocked = Math.min(simBlock, hpDmg);
        simBlock -= blocked;
        hpDmg -= blocked;
      }
      total += hpDmg;
      breakdown.push({ enemyId: enemy.id, raw: intent.value, afterBlock: hpDmg });
    }
    return { total, breakdown };
  }

  function getStagedEnergyCost(staged, hand) {
    let cost = 0;
    for (const action of staged) {
      const inst = hand.find((c) => c.uid === action.cardUid);
      if (!inst) continue;
      const card = CARDS[inst.cardId];
      if (card) cost += card.cost;
    }
    return cost;
  }

  function canStageCard(state, cardUid, staged) {
    const inst = state.hand.find((c) => c.uid === cardUid);
    if (!inst) return false;
    const card = CARDS[inst.cardId];
    if (!card) return false;
    const alreadyStaged = staged.some((s) => s.cardUid === cardUid);
    if (alreadyStaged) return false;
    const currentCost = getStagedEnergyCost(staged, state.hand);
    return currentCost + card.cost <= state.player.energy;
  }

  function checkVictory(state) {
    return livingEnemies(state).length === 0;
  }

  function checkDefeat(state) {
    return state.player.hp <= 0;
  }

  function soloPreviewCard(baseState, cardUid, target) {
    const inst = baseState.hand.find((c) => c.uid === cardUid);
    if (!inst) return null;
    const rng = createRng(baseState.seed + cardUid * 31);
    const state = cloneState(baseState);
    applyCard(state, inst.cardId, target || {}, rng);
    return {
      card: CARDS[inst.cardId],
      projectedEnemies: state.enemies.map((e) => ({
        id: e.id, hp: e.hp, dead: e.hp <= 0, lane: e.lane,
      })),
      projectedPlayer: { ...state.player },
    };
  }

  // ── Export ───────────────────────────────────────────────────────────────

  const Engine = {
    createRng,
    createInitialState,
    cloneState,
    CARDS,
    GLOSSARY,
    INTENT_TYPES,
    applyCard,
    resolveStagedTurn,
    resolveEnemyPhase,
    startNewTurn,
    computePreview,
    calculateIncomingDamage,
    getStagedEnergyCost,
    canStageCard,
    checkVictory,
    checkDefeat,
    soloPreviewCard,
    livingEnemies,
    getEnemy,
    enemiesInLane,
    drawCards,
    assignEnemyIntents,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Engine;
  } else {
    global.TideturnEngine = Engine;
  }
})(typeof window !== 'undefined' ? window : global);
