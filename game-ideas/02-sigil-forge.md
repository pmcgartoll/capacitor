# 02 · Sigil Forge — the synergy engine you deliberately build

> **Core verb: FORGE.** A symbol/engine builder in the Luck-be-a-Landlord family, redesigned
> so you can *reliably assemble the synergy you're chasing* instead of praying the RNG hands
> you the one piece you need.

## One-line pitch

You run a spinning "forge board" of symbols that pay out each round, but unlike its
inspirations you can **craft, fuse, target-draft, and bank** symbols — turning build-crafting
from a slot-machine into a deliberate engineering puzzle you can actually steer.

## The fantasy

You're a rune-smith feeding a great machine. Each round the machine spins/ticks, symbols
trigger in reading order, and you earn essence to survive the next quota. The joy is watching
a machine *you designed on purpose* erupt into a chain reaction — and the game gives you the
tools to design it on purpose.

## Which notes this answers

This concept exists to fix the specific frustration in your **Luck be a Landlord** note:
> "It's hard to build synergies because you only choose one of three symbols. And there's at
> least like 25 symbols each spin. I've had multiple times I'm trying toward a certain build
> and just can't get the one thing I need."

Everything below is a lever against that frustration, while keeping the addictive engine-
building payoff.

- **Balatro (you guess your outcome):** hold the **spin button** to preview the projected
  payout and see which symbols will chain — no more mystery scores.
- **Slice & Dice / Kalma (mobile readability + hold-to-preview):** the board is a clean grid;
  holding any symbol traces its synergy links with animated lines.
- **StS (art):** committed art direction so the engine reads as premium, not spreadsheet-y.

## Core loop

1. **Spin/tick:** the board resolves symbols in reading order; essence accrues with juicy
   chained pops.
2. **Meet quota** (rising each round) or lose.
3. **Draft & forge (the heart):** between rounds, use the *steering tools* below to shape your
   board toward an intended archetype.
4. **Escalate:** quotas rise, board slots grow, corruption/curses add pressure; reach the boss quota.

## Signature mechanics — the "steering toolkit"

Instead of the pure 1-of-3 draft, you get **multiple reliable levers**:

- **Targeted draft.** Rewards still offer choices, but you also earn **"blueprint tokens"**
  that let you pull a *specific* symbol from a browsable catalog for a premium price. If you
  need the one piece, you can go get it.
- **Fusion / forging.** Combine two symbols into a stronger hybrid (A + B → AB). This means
  duplicates and off-archetype junk are never fully dead — they're crafting fuel toward your build.
- **Banking / carry-over.** Stash a symbol you can't use yet in a small "vault" so a half-built
  combo isn't wasted by bad timing.
- **Pity / wish system.** Set a **"wish"** for an archetype; every reward that isn't your wish
  raises a meter that eventually guarantees a relevant symbol. RNG variety stays; dead runs die.
- **Board editing.** Cheaply remove/relocate symbols so reading-order chains can be arranged
  intentionally (order matters, and you control it).

Net effect: variety and surprise remain, but "I literally can't reach my plan" is designed out.

## Readability & preview (Pillars 2 & 3)

- **Hold the spin button** → ghost payout: projected essence, and a highlight of the chain
  path the symbols will fire in.
- **Hold any symbol** → animated lines to every symbol it synergizes with + plain-language
  reminder text; tap a keyword for the glossary.
- Reading order is shown as faint numbered arrows across the grid so chains are never a mystery.

## Mobile-first UX

- Portrait; the forge board fills the upper 2/3, controls in the thumb zone.
- Drafting/forging is a **card-tray drawer** you pull up from the bottom; drag symbols onto
  board slots or onto each other to fuse.
- Everything is tap/drag/hold — no hover, no tiny targets.

## Art & juice direction

- **Art:** warm **arcane-machinery / clockwork-alchemy** aesthetic — brass, glowing runes,
  moving gears — distinct from Landlord's flat icons and from Balatro's card felt.
- **Juice:** each chained trigger pops with escalating pitch and particle bloom; a big combo
  overloads the machine with a **screen-warping shader surge** and a cascading number counter
  (the Balatro-style dopamine, but you *previewed* it, so it lands as mastery).

## Difficulty & replayability

- **Ascension-style "overclock" tiers** raise quotas and add board curses.
- **Multiple forges (characters)** each bias the symbol pool toward different archetypes,
  changing what's craftable.
- **Daily seed** + score leaderboard; deterministic engine makes this trivial and fair.
- **"Build challenges":** win using a mandated archetype — showcases the steering toolkit and
  gives goal-oriented replay.

## MVP scope

- 1 forge/character, ~60 symbols across 4 archetypes, fusion + wish + targeted-draft systems,
  ~12 quota rounds + boss quota.
- Spin-preview + synergy-link highlighting (the readability core — build early).
- 3 overclock tiers + daily seed.

## Tech notes

- Deterministic TS "resolver" that evaluates the board in reading order → payout; the same
  resolver powers the hold-to-preview (run it, don't animate).
- PixiJS/WebGL for the board glow/particles; DOM for the draft/forge trays and glossary.
- Capacitor build; offline-first; daily/leaderboard on a light backend.

## Risks & open questions

- **Do the steering tools make it too easy / solvable?** Tune costs so steering is powerful but
  has opportunity cost; keep quotas aggressive so you can't grab *everything*.
- **Symbol interaction explosion** (combinatorial testing). Keep keywords composable and
  data-driven; lean on the deterministic resolver for automated balance sims.
- Reading-order UX must stay crystal clear as boards grow.

## Why it's radically different

It takes the engine-builder that your notes found *fun but frustrating* and makes the
**meta-game of assembling a synergy the actual gameplay** — with real tools to reach your
plan. It's the "steerable builds" pillar as an entire game.
