# Kismet — Vertical Slice Prototype

A mobile-first demo of **Kismet**, a dice-manipulation deckbuilder where you sculpt random rolls into the outcome you want — then assign dice, preview the exact result, and commit.

## How to run

**Option A — open directly**

Open `index.html` in a modern browser (Chrome, Safari, Firefox).

**Option B — local static server**

```bash
cd prototypes/04-kismet
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## What to try

1. **Roll** — tap **Roll Dice** to tumble your pool (animation is cosmetic; results are deterministic from the seed).
2. **Manipulate** — select a die (tap), then spend pips on **Reroll**, **Nudge ▲/▼** (cycle faces), or **Lock** (immune to rerolls). Watch the pip bar drain with a snap.
3. **Assign** — drag attack dice onto the enemy, block/mana dice onto the **Block** slot. Targeting lines show the exact numbers.
4. **Hold to preview** — press and hold **Hold to Resolve** (~0.4s) to see enemy HP, block gained, and damage you'll take next turn. Release to commit.
5. **Enemy turn** — after you resolve, the golem strikes with its telegraphed intent (icon + arrow + number). Block absorbs damage first.
6. **Win / reward** — defeat the Stone Golem, then optionally **Craft a Face** onto a die (tiny deckbuilding hint).

**Hold a die** (~0.35s) to see all six faces and reminder text.

## Architecture

| File | Role |
|------|------|
| `engine.js` | Seeded RNG, pure state transitions, `previewResolve()` |
| `game.js` | DOM rendering, pointer input, juice (particles, haptics, shake) |
| `styles.css` | Felt tabletop diorama, portrait thumb-zone layout |
| `index.html` | Entry point |

Preview reuses `KismetEngine.previewResolve()` on the live state — same logic as commit.

## Out of scope

- Single enemy encounter only (Stone Golem)
- Limited dice pool (~5 dice) and face set
- No run map, ascension, daily seeds, or leaderboards
- No audio (haptics only where supported)
