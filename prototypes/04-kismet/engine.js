/**
 * Kismet — deterministic dice combat engine (pure functions, no DOM).
 * Preview reuses the same resolver on a cloned state.
 */
(function (global) {
  'use strict';

  // ── Seeded RNG (mulberry32) ──────────────────────────────────────────────

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
    };
  }

  // ── Face & die templates ─────────────────────────────────────────────────

  const FACE_TYPES = {
    attack: { icon: '⚔', label: 'Attack' },
    block: { icon: '🛡', label: 'Block' },
    mana: { icon: '✦', label: 'Mana' },
    spark: { icon: '⚡', label: 'Spark' },
  };

  function face(type, value, reminder) {
    const meta = FACE_TYPES[type] || { icon: '?', label: type };
    return {
      type,
      value: value || 0,
      icon: meta.icon,
      label: meta.label,
      reminder: reminder || defaultReminder(type, value),
    };
  }

  function defaultReminder(type, value) {
    switch (type) {
      case 'attack':
        return `Deal ${value} damage when assigned to enemy`;
      case 'block':
        return `Gain ${value} Block when assigned to self`;
      case 'mana':
        return `Restore ${value} manipulation pip next turn`;
      case 'spark':
        return 'Next attack die deals +2 bonus damage';
      default:
        return '';
    }
  }

  const STARTING_DICE = [
    {
      id: 'blade',
      name: 'Blade Die',
      color: '#c45c4a',
      faces: [
        face('attack', 2),
        face('attack', 3),
        face('attack', 4),
        face('attack', 2),
        face('attack', 3),
        face('attack', 5),
      ],
    },
    {
      id: 'guard',
      name: 'Guard Die',
      color: '#5a8fc4',
      faces: [
        face('block', 1),
        face('block', 2),
        face('block', 3),
        face('block', 2),
        face('block', 1),
        face('block', 4),
      ],
    },
    {
      id: 'edge',
      name: 'Edge Die',
      color: '#b84a6a',
      faces: [
        face('attack', 4),
        face('attack', 5),
        face('attack', 3),
        face('spark', 0, 'Next attack +2'),
        face('attack', 4),
        face('attack', 6),
      ],
    },
    {
      id: 'ward',
      name: 'Ward Die',
      color: '#4a8a9c',
      faces: [
        face('block', 2),
        face('block', 3),
        face('block', 4),
        face('block', 2),
        face('mana', 1),
        face('block', 5),
      ],
    },
    {
      id: 'flux',
      name: 'Flux Die',
      color: '#8a6ab8',
      faces: [
        face('attack', 2),
        face('block', 2),
        face('attack', 3),
        face('block', 3),
        face('mana', 1),
        face('spark', 0, 'Next attack +2'),
      ],
    },
  ];

  const ENEMY_INTENTS = [
    { type: 'attack', value: 6 },
    { type: 'attack', value: 8 },
    { type: 'attack', value: 10 },
    { type: 'attack', value: 7 },
    { type: 'attack', value: 9 },
    { type: 'attack', value: 12 },
  ];

  const REWARD_FACES = [
    face('attack', 4),
    face('attack', 5),
    face('block', 3),
    face('block', 4),
    face('spark', 0, 'Next attack +2'),
    face('mana', 1),
  ];

  const MANIP_BUDGET = 3;
  const PLAYER_MAX_HP = 30;
  const ENEMY_MAX_HP = 36;

  // ── State helpers ────────────────────────────────────────────────────────

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function instantiateDice(templates) {
    return templates.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      color: tpl.color,
      faces: tpl.faces.map((f) => ({ ...f })),
      faceIndex: 0,
      locked: false,
      assignment: null,
    }));
  }

  function getFace(die) {
    return die.faces[die.faceIndex];
  }

  function wrapFaceIndex(index, len) {
    return ((index % len) + len) % len;
  }

  function makeRng(state) {
    const rng = createRng(state.seed);
    for (let i = 0; i < state.rngCounter; i++) rng.next();
    return rng;
  }

  function advanceRng(state, times) {
    state.rngCounter += times;
  }

  // ── Initial state ──────────────────────────────────────────────────────────

  function createInitialState(seed) {
    const s = seed != null ? seed >>> 0 : (Date.now() >>> 0);
    const state = {
      seed: s,
      rngCounter: 0,
      turn: 1,
      phase: 'await_roll',
      player: { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP, block: 0 },
      enemy: {
        hp: ENEMY_MAX_HP,
        maxHp: ENEMY_MAX_HP,
        name: 'Stone Golem',
        intent: { type: 'attack', value: 8 },
      },
      dice: instantiateDice(STARTING_DICE),
      manipulationBudget: MANIP_BUDGET,
      maxManipulationBudget: MANIP_BUDGET,
      sparkBonus: false,
      manaBonusNextTurn: 0,
      message: 'Roll your dice to begin.',
      outcome: null,
      pendingReward: null,
    };

    const rng = makeRng(state);
    state.enemy.intent = { ...rng.pick(ENEMY_INTENTS) };
    advanceRng(state, 1);
    return state;
  }

  // ── Roll (deterministic face selection) ────────────────────────────────────

  function computeRollResults(state) {
    const rng = makeRng(state);
    const results = {};
    let rolls = 0;
    state.dice.forEach((die) => {
      if (!die.locked) {
        results[die.id] = rng.int(0, die.faces.length - 1);
        rolls++;
      }
    });
    return { results, rolls };
  }

  function applyRoll(state, rollResults) {
    state.dice.forEach((die) => {
      if (rollResults[die.id] != null) {
        die.faceIndex = rollResults[die.id];
      }
      die.assignment = null;
    });
    state.phase = 'manipulate';
    state.message = 'Sculpt your roll — assign dice, then hold Resolve to preview.';
    return state;
  }

  function rollDice(state) {
    if (state.phase !== 'await_roll') return state;
    const next = cloneState(state);
    const { results, rolls } = computeRollResults(next);
    advanceRng(next, rolls);
    return applyRoll(next, results);
  }

  // ── Manipulation ───────────────────────────────────────────────────────────

  function spendBudget(state) {
    if (state.manipulationBudget <= 0) return false;
    state.manipulationBudget--;
    return true;
  }

  function rerollDie(state, dieId) {
    if (state.phase !== 'manipulate') return state;
    const die = state.dice.find((d) => d.id === dieId);
    if (!die || die.locked) return state;
    const next = cloneState(state);
    const target = next.dice.find((d) => d.id === dieId);
    if (!spendBudget(next)) return state;

    const rng = makeRng(next);
    target.faceIndex = rng.int(0, target.faces.length - 1);
    advanceRng(next, 1);
    next.message = `Rerolled ${target.name}.`;
    return next;
  }

  function nudgeDie(state, dieId, direction) {
    if (state.phase !== 'manipulate') return state;
    const die = state.dice.find((d) => d.id === dieId);
    if (!die) return state;
    const next = cloneState(state);
    const target = next.dice.find((d) => d.id === dieId);
    if (!spendBudget(next)) return state;

    const delta = direction > 0 ? 1 : -1;
    target.faceIndex = wrapFaceIndex(target.faceIndex + delta, target.faces.length);
    next.message = `Nudged ${target.name} ${delta > 0 ? 'up' : 'down'}.`;
    return next;
  }

  function lockDie(state, dieId) {
    if (state.phase !== 'manipulate') return state;
    const die = state.dice.find((d) => d.id === dieId);
    if (!die || die.locked) return state;
    const next = cloneState(state);
    const target = next.dice.find((d) => d.id === dieId);
    if (!spendBudget(next)) return state;

    target.locked = true;
    next.message = `Locked ${target.name} on ${getFace(target).icon}${getFace(target).value || ''}.`;
    return next;
  }

  function unlockAllDice(state) {
    state.dice.forEach((d) => {
      d.locked = false;
    });
  }

  // ── Assignment ─────────────────────────────────────────────────────────────

  function assignDie(state, dieId, target) {
    if (state.phase !== 'manipulate') return state;
    const next = cloneState(state);
    const die = next.dice.find((d) => d.id === dieId);
    if (!die) return state;

    if (target === die.assignment) {
      die.assignment = null;
    } else if (target === 'enemy' || target === 'self' || target === null) {
      die.assignment = target;
    }
    return next;
  }

  // ── Resolution (pure preview + apply) ─────────────────────────────────────

  function tallyAssignments(state) {
    let attack = 0;
    let block = 0;
    let mana = 0;
    let spark = false;

    state.dice.forEach((die) => {
      if (!die.assignment) return;
      const f = getFace(die);
      if (die.assignment === 'enemy' && f.type === 'attack') {
        attack += f.value;
      } else if (die.assignment === 'self' && f.type === 'block') {
        block += f.value;
      } else if (die.assignment === 'self' && f.type === 'mana') {
        mana += f.value;
      }
      if (f.type === 'spark') spark = true;
    });

    if (state.sparkBonus && attack > 0) attack += 2;
    if (spark) {
      /* spark on unassigned die still triggers if assigned? only if assigned to enemy for attack chain */
    }

    const assignedSparkToEnemy = state.dice.some(
      (d) => d.assignment === 'enemy' && getFace(d).type === 'spark'
    );
    const nextSparkBonus = assignedSparkToEnemy || spark;

    return { attack, block, mana, nextSparkBonus };
  }

  function previewResolve(state) {
    if (state.phase !== 'manipulate') {
      return {
        valid: false,
        playerHp: state.player.hp,
        playerBlock: state.player.block,
        enemyHp: state.enemy.hp,
        incomingDamage: state.enemy.intent.value,
        damageAfterBlock: Math.max(0, state.enemy.intent.value - state.player.block),
        attackDealt: 0,
        blockGained: 0,
        enemyDead: false,
        playerDead: false,
      };
    }

    const tally = tallyAssignments(state);
    const enemyHpAfter = Math.max(0, state.enemy.hp - tally.attack);
    const playerBlockAfter = state.player.block + tally.block;
    const incoming = state.enemy.intent.value;
    const damageAfterBlock = Math.max(0, incoming - playerBlockAfter);
    const playerHpAfterEnemy = state.player.hp - damageAfterBlock;

    return {
      valid: true,
      attackDealt: tally.attack,
      blockGained: tally.block,
      manaGained: tally.mana,
      enemyHp: enemyHpAfter,
      playerBlock: playerBlockAfter,
      incomingDamage: incoming,
      damageAfterBlock,
      playerHp: playerHpAfterEnemy,
      enemyDead: enemyHpAfter <= 0,
      playerDead: playerHpAfterEnemy <= 0 && enemyHpAfter > 0,
      nextSparkBonus: tally.nextSparkBonus,
    };
  }

  function resolveTurn(state) {
    if (state.phase !== 'manipulate') return state;
    const preview = previewResolve(state);
    const next = cloneState(state);

    next.enemy.hp = preview.enemyHp;
    next.player.block = preview.playerBlock;
    next.sparkBonus = preview.nextSparkBonus;
    next.manaBonusNextTurn = preview.manaGained || 0;

    if (preview.enemyDead) {
      next.phase = 'victory';
      next.outcome = preview;
      next.message = 'Enemy shattered! Victory.';
      return next;
    }

    next.phase = 'enemy_act';
    next.outcome = preview;
    next.message = 'Your dice land — the enemy strikes back!';
    return next;
  }

  function enemyAct(state) {
    if (state.phase !== 'enemy_act') return state;
    const next = cloneState(state);
    const preview = next.outcome || previewResolve(next);
    const incoming = next.enemy.intent.value;
    const blockUsed = Math.min(next.player.block, incoming);
    const damage = Math.max(0, incoming - next.player.block);

    next.player.block = Math.max(0, next.player.block - incoming);
    next.player.hp = Math.max(0, next.player.hp - damage);

    next.outcome = {
      ...preview,
      enemyDamageDealt: damage,
      blockConsumed: blockUsed,
      playerHp: next.player.hp,
      playerBlock: next.player.block,
    };

    if (next.player.hp <= 0) {
      next.phase = 'defeat';
      next.message = 'You fall. The golem grinds on.';
      return next;
    }

    return startNewTurn(next);
  }

  function pickEnemyIntent(state) {
    const rng = makeRng(state);
    const intent = { ...rng.pick(ENEMY_INTENTS) };
    advanceRng(state, 1);
    return intent;
  }

  function startNewTurn(state) {
    state.turn++;
    unlockAllDice(state);
    state.dice.forEach((d) => {
      d.assignment = null;
    });
    state.manipulationBudget = state.maxManipulationBudget + (state.manaBonusNextTurn || 0);
    state.manaBonusNextTurn = 0;
    state.enemy.intent = pickEnemyIntent(state);
    state.phase = 'await_roll';
    state.outcome = null;
    state.message = `Turn ${state.turn} — roll your dice.`;
    return state;
  }

  // ── Reward (face crafting) ─────────────────────────────────────────────────

  function beginReward(state) {
    const next = cloneState(state);
    const rng = makeRng(next);
    const choices = [];
    const pool = rng.pick([
      [0, 1, 2],
      [1, 2, 3],
      [2, 3, 4],
      [0, 2, 4],
    ]);
    advanceRng(next, 1);
    pool.forEach((idx) => choices.push({ ...REWARD_FACES[idx] }));
    next.phase = 'reward';
    next.pendingReward = { choices, targetDieId: next.dice[0].id };
    next.message = 'Craft a new face onto a die.';
    return next;
  }

  function setRewardTargetDie(state, dieId) {
    if (state.phase !== 'reward' || !state.pendingReward) return state;
    const next = cloneState(state);
    next.pendingReward.targetDieId = dieId;
    return next;
  }

  function applyReward(state, faceChoiceIndex) {
    if (state.phase !== 'reward' || !state.pendingReward) return state;
    const next = cloneState(state);
    const chosen = next.pendingReward.choices[faceChoiceIndex];
    if (!chosen) return state;

    const die = next.dice.find((d) => d.id === next.pendingReward.targetDieId);
    if (!die) return state;

    const replaceIndex = die.faceIndex;
    die.faces[replaceIndex] = { ...chosen };
    next.pendingReward = null;
    next.phase = 'menu';
    next.message = `Added ${chosen.icon}${chosen.value || ''} to ${die.name}. Play again?`;
    return next;
  }

  function resetBattle(seed) {
    return createInitialState(seed);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  global.KismetEngine = {
    FACE_TYPES,
    STARTING_DICE,
    MANIP_BUDGET,
    createRng,
    createInitialState,
    cloneState,
    computeRollResults,
    applyRoll,
    rollDice,
    rerollDie,
    nudgeDie,
    lockDie,
    assignDie,
    getFace,
    previewResolve,
    resolveTurn,
    enemyAct,
    beginReward,
    setRewardTargetDie,
    applyReward,
    resetBattle,
  };
})(typeof window !== 'undefined' ? window : global);
