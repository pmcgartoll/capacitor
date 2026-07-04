# 01 · Tideturn — the perfect-information tactics deckbuilder

> **Core verb: PLAN.** A Slay-the-Spire-depth card roguelike where you can *see the whole
> turn before you commit it.* No guessing, no hidden math, no ambiguity about who hits whom.

## One-line pitch

A turn-based card battler on a small tactical grid where holding any card ghosts the exact
resulting board — damage, deaths, buffs, enemy retaliation — so combat becomes a satisfying
puzzle of "find the perfect line," not a gamble.

## The fantasy

You are a tide-caller pushing back a rising, corrupted sea. Each battle is a self-contained
tactical position: a few lanes, a handful of enemies with fully telegraphed intentions, and a
hand of cards. Mastery feels like chess with juice — you *know* the position, and the thrill
is finding the elegant kill.

## Which notes this answers

- **Slay the Spire (combat good, art amateur):** keeps the deep card-combat loop and
  ascension structure; commits to a single strong art direction (see below).
- **Balatro (you guess your outcome):** the entire pitch is the *opposite* of guessing —
  hold-to-preview shows the exact result of a card or a whole queued turn.
- **Slice & Dice (can't tell who attacks whom on mobile):** explicit targeting arrows and
  on-target damage numbers make attack relationships glanceable, no hover required.
- **Dice of Kalma (hold to preview + too easy):** generalizes the hold-to-preview to every
  action; adds an ascension ladder + daily seeds for a real ceiling.

## Core loop

1. **Map:** choose a path node (fight / elite / event / shop / rest) — StS-style branching run.
2. **Battle (the heart):**
   - Enemies show **intent icons + arrows** to their exact target with the exact number.
   - You **drag cards onto targets**; each staged card shows a **ghost preview** overlaid on
     the board (numbers turn green→red, dying enemies fade, incoming damage recalculates live).
   - You can **stage a whole turn** (queue multiple cards), see the full projected end-state,
     reorder, then **commit** to watch it resolve with full juice.
3. **Reward:** pick 1 of 3 cards (with steer tools, see Pillar 4 below), gold, relics.
4. **Repeat** across ~3 acts + boss; unlock ascension modifiers.

## Signature mechanics

- **Ghost preview & turn staging.** The defining feature. Every staged action mutates a
  translucent "future board." Because logic is deterministic, the preview is *exact*, not an
  estimate. Committing replays the same computed result with animation.
- **Full telegraph.** Enemy intents are fully resolved and shown as arrows: "Crab → your
  front lane, 7 damage, next turn." Order-of-resolution is shown as small turn-order pips so
  there's never a mystery about sequencing.
- **Undo-until-commit.** Staging is free to rearrange; nothing is locked until you hit the
  glowing commit button. This removes fat-finger punishment on touchscreens.
- **Positional lanes.** A compact grid (e.g. 3 lanes) gives tactical texture — front/back,
  cleave, push/pull — without the readability nightmare of a big battlefield.

## Steerable builds (Pillar 4)

To avoid StS's "never drew my archetype" runs:
- Card rewards show your **current archetype affinity**; one of the three choices is weighted
  toward what you're already building.
- A **"blueprint" board** lets you mark 1–2 target cards; the shop and rewards get a small
  pity bump toward them.
- **Card removal / transform** is cheap and always available at rests, so you can thin toward
  your combo.

## Mobile-first UX

- Portrait. Hand fans across the bottom; **drag up onto a target** = the whole interaction.
- **Hold a card** (without dragging) = read its full rules + preview its solo effect in place.
- Targeting arrows are thick, colored, and animated; damage numbers sit *on* the target.
- Tap any keyword → inline glossary card. No wiki needed.
- Commit is a big bottom-center button; a subtle "you'll take X next turn" readout sits above it.

## Art & juice direction

- **Art:** a strong, cohesive look to dodge the "amateur" trap — proposed direction is
  **ink-and-wash / sumi-e with a single vivid accent color per act** (the encroaching tide).
  Limited palette, bold silhouettes, readable at phone size, cheap-ish to produce consistently.
- **Juice:** hit-stop on impact, ink-splash particles, a satisfying "wave" screen distortion
  shader when a big combo resolves, chunky number pop, layered audio that stingers on kills.
- Because outcomes are previewed, the resolve animation can be **fast and punchy** (you
  already know what happens) — great for the "satisfying attack effects" goal.

## Difficulty & replayability

- Base run: welcoming, beatable, teaches the preview system.
- **Ascension ladder (20+ tiers)** of stacking modifiers for the ceiling.
- **Daily seed:** everyone gets the same run; leaderboard by score/speed. Perfect-information
  design makes dailies feel *fair and skill-testing*, not luck-lotteries.
- **Puzzle mode:** hand-authored positions ("win in one turn") — trivial to build because the
  engine is deterministic, and a great low-commitment mobile session + tutorial funnel.

## MVP scope

- 1 act, 1 playable character/class, ~40 cards, ~8 enemies + 1 boss, 6 relics.
- Full ghost-preview + turn-staging + telegraph systems (these are the whole point — build first).
- 3 ascension tiers + daily seed as the replay hook.

## Tech notes

- Deterministic TS combat engine (pure function: `state + queuedActions -> previewState`),
  which makes the preview *free* — it's just running the engine without animating.
- PixiJS/WebGL for board + juice; DOM for menus/glossary/accessibility.
- Capacitor for iOS/Android; runs offline. Daily seeds + leaderboard need only a tiny backend.

## Risks & open questions

- **Does perfect information reduce tension?** Mitigation: tension moves to *card draw*,
  *deckbuilding decisions*, and *ascension modifiers*, not hidden combat math.
- **Preview complexity** with many stacked triggers — must keep card effects composable and
  the preview renderer performant.
- Grid tactics on a small screen must stay uncluttered; keep lane count low.

## Why it's radically different

It inverts the genre's usual "commit then find out." The whole product is **anti-guessing
tactical combat** — the thing your notes praised in Kalma, made the entire pillar.
