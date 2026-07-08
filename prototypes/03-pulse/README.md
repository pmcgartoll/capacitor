# Pulse — Vertical Slice Prototype

A one-thumb, real-time deck duel prototype built to showcase **feel**: neon juice, hold-to-slow aim, telegraphed enemy attacks, and a flow multiplier that rewards clean play.

## How to run

**Option A — open directly**

Open `index.html` in a modern browser (Chrome, Safari, Firefox).

**Option B — local static server**

```bash
cd prototypes/03-pulse
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

No build step. No dependencies. Works offline.

## What to try

1. **Hold a card to slow time** — tap a card in the bottom hand, drag toward the enemy, and hold (~200ms). The world crawls; damage rings and aim lines show exactly what will happen. Release to fire at full speed with particles and shake.

2. **Swipe to dodge** — when the enemy telegraphs a lateral swipe (colored zone + arrow), flick left or right on the arena (not on a card) to dodge. Clean dodges build **FLOW**.

3. **Build the flow multiplier** — land hits, dodge attacks, and play without taking damage to raise the ×FLOW meter (top-right arc). Higher flow = more damage and louder visuals. Getting hit or whiffing AoE shots drops it.

4. **Toggle “Slow telegraphs”** — accessibility assist that stretches enemy wind-up bars by ~35%.

5. **Beat both phases** — defeat the Sentinel, then its faster MK-II form. Win screen shows peak flow and score.

## Controls

| Input | Action |
| --- | --- |
| Tap card | Select |
| Drag | Aim at enemy / position |
| Hold card | Time-dilation preview |
| Release | Play card (costs energy) |
| Swipe L/R on arena | Dodge telegraphed swipe attacks |
| ↺ button | Restart fight |

Cards auto-draw into your hand every ~2.4s (max 4). Energy refills continuously.

## Card kit

| Card | Cost | Effect |
| --- | --- | --- |
| Bolt | 25 | Fast single-target projectile |
| Spray | 35 | Cone AoE — aim carefully |
| Shield | 30 | Temporary damage block |
| Dash | 20 | Quick dodge + i-frames |
| Pulse | 40 | Burst around you |
| Spike | 30 | Heavy piercing bolt |
| Drain | 35 | Close-range drain + heal |
| Nova | 55 | Big AoE finisher at aim point |

## Tech notes

- Fixed-timestep simulation (60 Hz accumulator) decoupled from `requestAnimationFrame` rendering
- Seeded RNG (`mulberry32`, default seed `1337`) for reproducible runs
- Auto-pause on tab background (`visibilitychange`)
- Optional WebAudio synth tones + `navigator.vibrate` (guarded)
- Portrait-first layout (~390×844 design space), centered on desktop

## Out of scope

This is a **single-fight vertical slice**, not the full game:

- No run map, rewards, or meta progression
- No deckbuilding between fights (fixed starter deck)
- No ascension tiers, daily gauntlet, or leaderboards
- One enemy archetype (two phases), not a full bestiary
- Shader effects are canvas-drawn approximations (no GPU shader pipeline)

## Files

- `index.html` — shell, overlays, how-to-play hint
- `styles.css` — synthwave UI chrome
- `engine.js` — deterministic game logic (cards, enemy AI, flow, fixed-step sim)
- `game.js` — canvas renderer, input, juice, audio, main loop
