# Sigil Forge — Vertical Slice Prototype

A mobile-first demo of the **Sigil Forge** core loop: spin a symbol board in reading order, meet rising essence quotas, and **steer your build** between rounds with targeted draft, blueprint pulls, fusion, and a wish/pity meter.

## How to run

1. Open `index.html` directly in a browser (`file://`), or
2. Serve the folder statically, e.g. `python3 -m http.server 8080` from this directory, then visit `http://localhost:8080`.

No build step or dependencies required. Works fully offline.

## What to try

- **Hold Forge Spin** (~0.3s) to ghost-preview the exact payout and see which slots will fire in chain order. Release to dismiss; **tap** to commit the spin.
- **Hold any board symbol** to trace synergy links (animated curves) and read its reminder text. Tap highlighted **keywords** for an inline glossary.
- **Open the forge tray** (⚒ button) between rounds:
  - **Draft** — drag one of three offered symbols onto an empty slot.
  - **Blueprint** — spend 3 blueprint tokens to pull a **specific** symbol from the catalog.
  - **Wish** — set an archetype wish; non-matching drafts fill a pity meter that eventually guarantees a match.
  - **Fusion** — drag one board symbol onto another (see fusion recipes). Coin+Cat → Lucky Cat, Gem+Torch → Blazing Gem, etc.
- Survive **6 escalating rounds** (final boss quota: 75 essence) to win. Miss a quota and the run ends.

## Architecture

| File | Role |
|------|------|
| `engine.js` | Seeded RNG, symbol data, pure `resolveBoard()` resolver, fusion table, game state — no DOM |
| `game.js` | Rendering, pointer input, juice (particles, tones, haptics), drawer UI |
| `styles.css` | Portrait mobile layout, brass/arcane aesthetic |
| `index.html` | Shell markup |

The hold-to-preview reuses the same deterministic resolver as the actual spin (no separate animation logic for outcomes).

## Out of scope

- Full run map, meta progression, or multiple forge characters
- Complete symbol roster (~60 symbols / 4 archetypes in the full design)
- Banking/vault, board curse, overclock tiers, daily seed leaderboard
- External assets, shaders, or audio files (juice is CSS/canvas/Web Audio only)
