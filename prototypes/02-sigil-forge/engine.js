/**
 * Sigil Forge — Pure game logic (deterministic, renderer-agnostic)
 */

(function (global) {
  'use strict';

  // ── Seeded RNG (mulberry32) ──────────────────────────────────────────
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

  // ── Symbol definitions ───────────────────────────────────────────────
  const ARCHETYPES = {
    wealth: { id: 'wealth', label: 'Wealth', color: '#d4a84b' },
    nature: { id: 'nature', label: 'Nature', color: '#6ecf6e' },
    fire: { id: 'fire', label: 'Fire', color: '#e87840' },
    arcane: { id: 'arcane', label: 'Arcane', color: '#9b7fd4' },
  };

  const SYMBOLS = {
    coin: {
      id: 'coin',
      name: 'Coin',
      glyph: '◎',
      archetype: 'wealth',
      reminder: '+1 essence',
      keywords: ['essence'],
    },
    gem: {
      id: 'gem',
      name: 'Gem',
      glyph: '◆',
      archetype: 'wealth',
      reminder: '+2, +1 per other Gem',
      keywords: ['Gem'],
    },
    miner: {
      id: 'miner',
      name: 'Miner',
      glyph: '⛏',
      archetype: 'wealth',
      reminder: 'Copies left neighbor value',
      keywords: ['neighbor'],
    },
    cat: {
      id: 'cat',
      name: 'Cat',
      glyph: '🐱',
      archetype: 'nature',
      reminder: '+2 if beside a Coin',
      keywords: ['Coin', 'adjacent'],
    },
    bloom: {
      id: 'bloom',
      name: 'Bloom',
      glyph: '✿',
      archetype: 'nature',
      reminder: '+1 per filled neighbor',
      keywords: ['neighbor', 'adjacent'],
    },
    vine: {
      id: 'vine',
      name: 'Vine',
      glyph: '〰',
      archetype: 'nature',
      reminder: '+1, spreads +1 to neighbors',
      keywords: ['neighbor', 'spread'],
    },
    torch: {
      id: 'torch',
      name: 'Torch',
      glyph: '🔥',
      archetype: 'fire',
      reminder: '+1, boosts neighbors +1',
      keywords: ['neighbor', 'boost'],
    },
    ember: {
      id: 'ember',
      name: 'Ember',
      glyph: '✦',
      archetype: 'fire',
      reminder: '+3 if beside Torch',
      keywords: ['Torch', 'adjacent'],
    },
    kiln: {
      id: 'kiln',
      name: 'Kiln',
      glyph: '⚙',
      archetype: 'fire',
      reminder: '+2, +1 per Fire symbol',
      keywords: ['Fire'],
    },
    star: {
      id: 'star',
      name: 'Star',
      glyph: '★',
      archetype: 'arcane',
      reminder: '×1.5 running total',
      keywords: ['multiply'],
    },
    rune: {
      id: 'rune',
      name: 'Rune',
      glyph: 'ᚱ',
      archetype: 'arcane',
      reminder: '+1, doubles next symbol',
      keywords: ['double', 'next'],
    },
    echo: {
      id: 'echo',
      name: 'Echo',
      glyph: '⟲',
      archetype: 'arcane',
      reminder: 'Repeats previous payout',
      keywords: ['repeat', 'previous'],
    },
    gear: {
      id: 'gear',
      name: 'Gear',
      glyph: '⚙',
      archetype: 'arcane',
      reminder: '+1, +1 per Gear',
      keywords: ['Gear'],
    },
    // Fusion hybrids
    gold_cat: {
      id: 'gold_cat',
      name: 'Lucky Cat',
      glyph: '🐾',
      archetype: 'wealth',
      reminder: '+4, +2 per Coin',
      keywords: ['Coin'],
      fusion: true,
    },
    blazing_gem: {
      id: 'blazing_gem',
      name: 'Blazing Gem',
      glyph: '🔶',
      archetype: 'fire',
      reminder: '+5, boosts neighbors +2',
      keywords: ['neighbor', 'boost'],
      fusion: true,
    },
    starforge: {
      id: 'starforge',
      name: 'Starforge',
      glyph: '✧',
      archetype: 'arcane',
      reminder: '+3, ×1.25 total',
      keywords: ['multiply'],
      fusion: true,
    },
    wild_bloom: {
      id: 'wild_bloom',
      name: 'Wild Bloom',
      glyph: '🌸',
      archetype: 'nature',
      reminder: '+2 per neighbor symbol',
      keywords: ['neighbor'],
      fusion: true,
    },
  };

  const DRAFT_POOL = [
    'coin', 'gem', 'miner', 'cat', 'bloom', 'vine',
    'torch', 'ember', 'kiln', 'star', 'rune', 'echo', 'gear',
  ];

  const FUSION_TABLE = {
    'coin+cat': 'gold_cat',
    'cat+coin': 'gold_cat',
    'gem+torch': 'blazing_gem',
    'torch+gem': 'blazing_gem',
    'star+rune': 'starforge',
    'rune+star': 'starforge',
    'bloom+vine': 'wild_bloom',
    'vine+bloom': 'wild_bloom',
    'coin+coin': 'gem',
    'gem+gem': 'blazing_gem',
    'torch+ember': 'kiln',
    'ember+torch': 'kiln',
    'echo+rune': 'starforge',
    'rune+echo': 'starforge',
  };

  const BLUEPRINT_COST = 3;

  const ROUND_QUOTAS = [8, 15, 25, 40, 55, 75];

  const GLOSSARY = {
    essence: 'The currency you earn each spin. Meet the quota to advance.',
    Gem: 'Another Gem symbol anywhere on the board.',
    Coin: 'A Coin symbol orthogonally adjacent to this one.',
    Torch: 'A Torch symbol orthogonally adjacent to this one.',
    neighbor: 'An orthogonally adjacent slot (up/down/left/right).',
    adjacent: 'Sharing an edge with this symbol (not diagonal).',
    boost: 'Adds bonus essence to boosted symbols when they resolve.',
    spread: 'Grants bonus to neighboring symbols.',
    multiply: 'Multiplies the running essence total.',
    double: 'The next symbol in reading order earns double.',
    next: 'The next symbol resolved in reading order.',
    previous: 'The previous symbol resolved in reading order.',
    repeat: 'Triggers the same payout as the prior symbol.',
    Fire: 'Any symbol with the Fire archetype on the board.',
    Gear: 'Another Gear symbol on the board.',
  };

  const COLS = 4;
  const ROWS = 4;

  function idxToPos(i) {
    return { row: Math.floor(i / COLS), col: i % COLS };
  }

  function posToIdx(row, col) {
    return row * COLS + col;
  }

  function cloneBoard(board) {
    return board.map((s) => (s ? { ...s } : null));
  }

  function getNeighbors(i, board) {
    const { row, col } = idxToPos(i);
    const out = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        const ni = posToIdx(r, c);
        if (board[ni]) out.push(ni);
      }
    }
    return out;
  }

  function getLeftNeighbor(i) {
    const { row, col } = idxToPos(i);
    if (col > 0) return posToIdx(row, col - 1);
    return -1;
  }

  function countOnBoard(board, predicate) {
    let n = 0;
    for (const s of board) {
      if (s && predicate(s)) n++;
    }
    return n;
  }

  function countArchetype(board, archetype) {
    return countOnBoard(board, (s) => SYMBOLS[s.id]?.archetype === archetype);
  }

  /**
   * Pure resolver — evaluates board in reading order.
   * Returns { total, chain: [{ index, symbolId, payout, note, runningTotal }] }
   */
  function resolveBoard(board) {
    const chain = [];
    let total = 0;
    let doubleNext = false;
    let lastPayout = 0;
    const boosts = new Array(board.length).fill(0);

    // Pre-pass: torch/kiln/blazing_gem neighbor boosts
    for (let i = 0; i < board.length; i++) {
      const sym = board[i];
      if (!sym) continue;
      const def = SYMBOLS[sym.id];
      if (!def) continue;
      if (sym.id === 'torch') {
        for (const ni of getNeighbors(i, board)) boosts[ni] += 1;
      } else if (sym.id === 'blazing_gem') {
        for (const ni of getNeighbors(i, board)) boosts[ni] += 2;
      } else if (sym.id === 'vine') {
        for (const ni of getNeighbors(i, board)) boosts[ni] += 1;
      }
    }

    for (let i = 0; i < board.length; i++) {
      const sym = board[i];
      if (!sym) continue;
      const def = SYMBOLS[sym.id];
      if (!def) continue;

      let payout = 0;
      let note = '';

      switch (sym.id) {
        case 'coin':
          payout = 1;
          break;
        case 'gem': {
          const others = countOnBoard(board, (s) => s.id === 'gem') - 1;
          payout = 2 + Math.max(0, others);
          note = others > 0 ? `+${others} from other Gems` : '';
          break;
        }
        case 'miner': {
          const left = getLeftNeighbor(i);
          if (left >= 0 && chain.length > 0) {
            const leftChain = chain.filter((c) => c.index === left).pop();
            payout = leftChain ? leftChain.payout : 0;
            note = payout > 0 ? 'copied left' : 'nothing to copy';
          }
          break;
        }
        case 'cat': {
          const hasCoin = getNeighbors(i, board).some(
            (ni) => board[ni]?.id === 'coin'
          );
          payout = hasCoin ? 2 : 0;
          note = hasCoin ? 'Coin nearby!' : '';
          break;
        }
        case 'bloom': {
          const filled = getNeighbors(i, board).length;
          payout = filled;
          note = filled ? `${filled} neighbors` : '';
          break;
        }
        case 'vine':
          payout = 1;
          break;
        case 'torch':
          payout = 1;
          break;
        case 'ember': {
          const hasTorch = getNeighbors(i, board).some(
            (ni) => board[ni]?.id === 'torch' || board[ni]?.id === 'kiln'
          );
          payout = hasTorch ? 3 : 0;
          note = hasTorch ? 'Torch nearby!' : '';
          break;
        }
        case 'kiln': {
          const fireCount = countArchetype(board, 'fire');
          payout = 2 + Math.max(0, fireCount - 1);
          break;
        }
        case 'star':
          if (total > 0) {
            const before = total;
            total = Math.floor(total * 1.5);
            payout = total - before;
            note = '×1.5 total';
          } else {
            payout = 0;
            note = 'no total to multiply';
          }
          break;
        case 'rune':
          payout = 1;
          doubleNext = true;
          note = 'next doubled';
          break;
        case 'echo':
          payout = lastPayout;
          note = lastPayout ? 'echoed' : '';
          break;
        case 'gear': {
          const others = countOnBoard(board, (s) => s.id === 'gear') - 1;
          payout = 1 + Math.max(0, others);
          break;
        }
        case 'gold_cat': {
          const coins = countOnBoard(board, (s) => s.id === 'coin');
          payout = 4 + coins * 2;
          note = coins ? `+${coins * 2} from Coins` : '';
          break;
        }
        case 'blazing_gem':
          payout = 5;
          break;
        case 'starforge': {
          payout = 3;
          if (total > 0) {
            const before = total;
            total = Math.floor(total * 1.25);
            payout += total - before;
            note = '+3, ×1.25';
          }
          break;
        }
        case 'wild_bloom': {
          const neighbors = getNeighbors(i, board).filter((ni) => board[ni]);
          payout = neighbors.length * 2;
          note = `${neighbors.length} neighbors`;
          break;
        }
        default:
          payout = 0;
      }

      // Apply boosts from torches etc.
      if (boosts[i] > 0 && sym.id !== 'star' && sym.id !== 'starforge') {
        payout += boosts[i];
        note = note ? `${note}, +${boosts[i]} boosted` : `+${boosts[i]} boosted`;
      }

      if (doubleNext && sym.id !== 'rune') {
        payout *= 2;
        note = note ? `${note}, doubled` : 'doubled';
        doubleNext = false;
      }

      if (sym.id !== 'star' && sym.id !== 'starforge') {
        total += payout;
      }
      lastPayout = payout;

      chain.push({
        index: i,
        symbolId: sym.id,
        payout,
        note,
        runningTotal: total,
      });
    }

    return { total, chain };
  }

  function getSynergyLinks(board, index) {
    const sym = board[index];
    if (!sym) return [];
    const links = [];
    const def = SYMBOLS[sym.id];
    if (!def) return links;

    switch (sym.id) {
      case 'cat':
      case 'gold_cat':
        for (const ni of getNeighbors(index, board)) {
          if (board[ni]?.id === 'coin') links.push({ from: index, to: ni, label: 'Coin synergy' });
        }
        break;
      case 'ember':
        for (const ni of getNeighbors(index, board)) {
          const nid = board[ni]?.id;
          if (nid === 'torch' || nid === 'kiln') links.push({ from: index, to: ni, label: 'Fire synergy' });
        }
        break;
      case 'torch':
      case 'blazing_gem':
      case 'vine':
        for (const ni of getNeighbors(index, board)) {
          if (board[ni]) links.push({ from: index, to: ni, label: 'Boosts' });
        }
        break;
      case 'bloom':
      case 'wild_bloom':
        for (const ni of getNeighbors(index, board)) {
          if (board[ni]) links.push({ from: index, to: ni, label: 'Neighbor' });
        }
        break;
      case 'miner': {
        const left = getLeftNeighbor(index);
        if (left >= 0 && board[left]) links.push({ from: index, to: left, label: 'Copies' });
        break;
      }
      case 'gem':
        for (let i = 0; i < board.length; i++) {
          if (i !== index && board[i]?.id === 'gem') links.push({ from: index, to: i, label: 'Gem stack' });
        }
        break;
      case 'gear':
        for (let i = 0; i < board.length; i++) {
          if (i !== index && board[i]?.id === 'gear') links.push({ from: index, to: i, label: 'Gear stack' });
        }
        break;
      case 'rune':
        for (let i = index + 1; i < board.length; i++) {
          if (board[i]) {
            links.push({ from: index, to: i, label: 'Doubles next' });
            break;
          }
        }
        break;
      case 'echo':
        for (let i = index - 1; i >= 0; i--) {
          if (board[i]) {
            links.push({ from: index, to: i, label: 'Echoes' });
            break;
          }
        }
        break;
      default:
        break;
    }
    return links;
  }

  function fuseSymbols(idA, idB) {
    const key = `${idA}+${idB}`;
    const resultId = FUSION_TABLE[key];
    if (!resultId) return null;
    return { id: resultId, ...SYMBOLS[resultId] };
  }

  function createInitialBoard(rng) {
    const board = new Array(COLS * ROWS).fill(null);
    const starters = ['coin', 'coin', 'torch', 'cat', 'gem', 'rune'];
    const slots = rng.shuffle(
      Array.from({ length: board.length }, (_, i) => i)
    ).slice(0, starters.length);
    starters.forEach((id, i) => {
      board[slots[i]] = { id };
    });
    return board;
  }

  function createGameState(seed) {
    const rng = createRng(seed);
    return {
      seed,
      rng,
      board: createInitialBoard(rng),
      round: 0,
      essence: 0,
      roundEssence: 0,
      phase: 'steer', // steer | spin | result | win | lose
      blueprintTokens: 1,
      wishArchetype: null,
      pityMeter: 0,
      pityThreshold: 5,
      draftOptions: [],
      draggedFrom: null,
      fusionTarget: null,
    };
  }

  function getQuota(state) {
    return ROUND_QUOTAS[Math.min(state.round, ROUND_QUOTAS.length - 1)];
  }

  function isBossRound(state) {
    return state.round === ROUND_QUOTAS.length - 1;
  }

  function generateDraftOptions(state) {
    const pool = DRAFT_POOL.slice();
    const options = [];
    const used = new Set();
    for (let i = 0; i < 3; i++) {
      let id;
      let attempts = 0;
      do {
        if (state.wishArchetype && state.pityMeter >= state.pityThreshold) {
          const wishPool = pool.filter(
            (pid) => SYMBOLS[pid].archetype === state.wishArchetype
          );
          id = rngPickWish(state, wishPool.length ? wishPool : pool);
          state.pityMeter = 0;
        } else {
          id = state.rng.pick(pool);
        }
        attempts++;
      } while (used.has(id) && attempts < 20);
      used.add(id);
      options.push({ id });

      if (state.wishArchetype && SYMBOLS[id].archetype !== state.wishArchetype) {
        state.pityMeter = Math.min(state.pityThreshold, state.pityMeter + 1);
      }
    }
    return options;
  }

  function rngPickWish(state, pool) {
    return state.rng.pick(pool);
  }

  function startSteerPhase(state) {
    state.phase = 'steer';
    state.roundEssence = 0;
    state.draftOptions = generateDraftOptions(state);
    if (state.round > 0) {
      state.blueprintTokens += 1;
    }
  }

  function placeSymbol(state, slotIndex, symbolId) {
    if (state.board[slotIndex]) return false;
    state.board[slotIndex] = { id: symbolId };
    return true;
  }

  function removeSymbol(state, slotIndex) {
    if (!state.board[slotIndex]) return null;
    const sym = state.board[slotIndex];
    state.board[slotIndex] = null;
    return sym;
  }

  function applyFusion(state, fromIndex, toIndex) {
    const a = state.board[fromIndex];
    const b = state.board[toIndex];
    if (!a || !b || fromIndex === toIndex) return false;
    const fused = fuseSymbols(a.id, b.id);
    if (!fused) return false;
    state.board[toIndex] = { id: fused.id };
    state.board[fromIndex] = null;
    return true;
  }

  function blueprintPull(state, symbolId) {
    if (state.blueprintTokens < BLUEPRINT_COST) return false;
    const empty = state.board.findIndex((s) => !s);
    if (empty < 0) return false;
    state.blueprintTokens -= BLUEPRINT_COST;
    state.board[empty] = { id: symbolId };
    if (state.wishArchetype && SYMBOLS[symbolId].archetype !== state.wishArchetype) {
      state.pityMeter = Math.min(state.pityThreshold, state.pityMeter + 1);
    }
    return true;
  }

  function beginSpin(state) {
    state.phase = 'spin';
    const preview = resolveBoard(state.board);
    return preview;
  }

  function finishSpin(state, earned) {
    state.essence += earned;
    state.roundEssence = earned;
    const quota = getQuota(state);
    if (earned >= quota) {
      if (state.round >= ROUND_QUOTAS.length - 1) {
        state.phase = 'win';
      } else {
        state.round++;
        startSteerPhase(state);
      }
    } else {
      state.phase = 'lose';
    }
  }

  function resetGame(seed) {
    return createGameState(seed || Date.now());
  }

  const SigilEngine = {
    COLS,
    ROWS,
    ARCHETYPES,
    SYMBOLS,
    DRAFT_POOL,
    FUSION_TABLE,
    BLUEPRINT_COST,
    ROUND_QUOTAS,
    GLOSSARY,
    createRng,
    createGameState,
    cloneBoard,
    resolveBoard,
    getSynergyLinks,
    fuseSymbols,
    getQuota,
    isBossRound,
    generateDraftOptions,
    startSteerPhase,
    placeSymbol,
    removeSymbol,
    applyFusion,
    blueprintPull,
    beginSpin,
    finishSpin,
    resetGame,
    idxToPos,
    posToIdx,
    getNeighbors,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SigilEngine;
  } else {
    global.SigilEngine = SigilEngine;
  }
})(typeof window !== 'undefined' ? window : global);
