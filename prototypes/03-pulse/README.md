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

2. **Swipe to dodge** — every enemy attack telegraphs its **exact hit zone** (dashed outline while it tracks you, solid + glowing once it **locks**). Flick left or right on the arena (not on a card) to get out of the zone before the windup bar fills. Clean dodges build **FLOW**.

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
| Swipe L/R on arena | Move / dodge (brief i-frames) — the only movement verb |
| ↺ button | Restart fight |

Cards auto-draw into your hand every ~2.4s (max 4). Energy refills continuously.

## Card kit

| Card | Cost | Effect |
| --- | --- | --- |
| Bolt | 25 | Fast single-target projectile |
| Spray | 35 | Long cone AoE — aim carefully |
| Shield | 30 | Temporary damage block |
| Pulse | 40 | Energy burst at aim point (leashed range; crit near center) |
| Spike | 30 | Heavy piercing bolt |
| Drain | 35 | Aimed siphon (leashed range) — damage + heal on hit |
| Nova | 55 | Big AoE finisher at aim point |

(The old Dash card was removed: swiping is the one movement/dodge verb, and a
card duplicating it for energy muddied the controls.)

## Tech notes

### Architecture: zones as shared data

Every attack — enemy pattern or player card — declares its hit area as a **Shape**
(circle / band / beam / cone) built by a pure `zone(gameState)` function. One shared
`circleOverlaps` test resolves all of them, and the renderer draws the shape object
verbatim (`drawZone`). Because the telegraph, the hold-preview verdict, and the damage
resolution all consume the *same* shape, the picture on screen is always the exact
hitbox — telegraphs cannot lie by construction.

Enemy attacks **track** the player during windup, then **lock** at a fixed fraction of
the windup (`lockAt`, marked on the windup bar). After the lock the zone freezes, so
moving out of it is a real, rewarded dodge. One resolution rule for every attack:
are you inside the zone when the bar fills?

Adding a new attack or zone card is data, not code: a windup, a damage number, a color,
and a `zone()` function.

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
