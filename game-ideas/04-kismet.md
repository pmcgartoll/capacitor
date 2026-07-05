# 04 · Kismet — dice manipulation with a real ceiling

> **Core verb: PRESS YOUR LUCK.** A mobile-native dice-deckbuilder in the spirit of Dice of
> Kalma and Slice & Dice — but engineered around *bending* dice results and around a
> genuinely hard, long-tail difficulty curve so it can't be beaten first-try and forgotten.

## One-line pitch

You build a "pool" of custom dice instead of a deck of cards; each turn you roll, then use a
toolkit of rerolls, nudges, splits and locks to *sculpt* your roll into the outcome you
want — a tactile, glanceable, deeply replayable roguelike with an ascension ceiling that bites.

## The fantasy

Fate is a set of dice you can cheat. You feel like a gambler who has quietly learned to load
the dice — the tension of the roll plus the satisfaction of manipulating it into exactly what
your plan needs.

## Which notes this answers

- **Dice of Kalma (best mobile UX, hold-to-preview, but too easy):** keeps the mobile-native
  feel and hold-to-preview; the *whole design thesis* is fixing "too easy — beat all 25 rounds
  first try" with a real difficulty architecture (below).
- **Slice & Dice (dice combat fun, but unreadable on mobile):** keeps the tactile dice-combat
  joy; makes attacker→target relationships and rules glanceable without hovering.
- **Luck be a Landlord (can't reach your build):** dice manipulation *is* the steering — you
  can bend RNG toward your plan every single turn.
- **Balatro (guessing):** hold the resolve button to preview the exact result of your current
  dice assignment before committing.

## Core loop

1. **Roll:** roll your pool of dice (each die is a customizable object with faces = effects:
   attack, block, mana, symbol triggers, etc.).
2. **Manipulate (the heart):** spend a limited manipulation budget to **reroll, nudge (±1),
   split a die, merge two, lock a face, or copy** — sculpting the roll toward your plan.
3. **Assign & resolve:** drag dice onto targets/slots; **hold to preview** the exact outcome;
   commit and watch it resolve with juice.
4. **Build between fights:** add faces to dice, add dice, craft/fuse dice, remove weak faces —
   deckbuilding, but on dice.
5. **Run:** branching map, elites, bosses, escalating difficulty.

## Signature mechanics

- **Manipulation toolkit.** The core skill expression: a small budget of reroll/nudge/split/
  merge/lock/copy actions per turn turns a random roll into a solvable puzzle. This is both the
  fun *and* the anti-frustration lever (you can reach your build).
- **Face-crafting deckbuilding.** You don't just collect dice — you edit their faces. Thinning
  a die of bad faces is this game's "card removal"; adding synergy faces is its "reward pick."
- **Hold-to-preview resolution.** Assign dice, hold, see exact damage/block/triggers, adjust,
  commit. The Kalma play-button idea, applied to a whole dice assignment.
- **Readable combat.** Each enemy shows intent + a targeting arrow; assigned dice draw a line
  to their target with the resulting number on it. No hover, no press-and-hold-to-read.

## The difficulty architecture (the point of this concept)

Directly solving "too easy, beat it first try":

- **A demanding base curve** — the standard run is genuinely challenging, not a formality.
- **Deep ascension ladder (20+ tiers)** of stacking modifiers (enemy dice too, fewer
  manipulations, curses on your pool).
- **Weekly & daily seeds** with global leaderboards — deterministic dice logic makes this fair.
- **Heat/streak system:** optional escalating modifiers you *choose* to bank bigger rewards,
  press-your-luck style, giving experts a self-set ceiling.
- **Endless/gauntlet mode** past the "final" boss for the score-chasers.
- **Async "ghost" races:** replay another player's seed and beat their result — cheap
  competitive long-tail without real-time netcode.

## Mobile-first UX

- Portrait; dice tray in the thumb zone, board above.
- Every manipulation is a **tap or drag** on a die; the manipulation budget is a visible pip bar.
- Hold-to-preview on the resolve button; hold-a-die to read its faces + rules; tap keyword → glossary.
- Chunky, physical dice with satisfying roll physics and haptics — the tactile Kalma feel.

## Art & juice direction

- **Art:** tactile, premium **tabletop-diorama** look — real-feeling dice, felt, carved
  tokens, warm lighting — distinct from Slice & Dice's flatter presentation.
- **Juice:** weighty dice physics + haptics on roll and lock, a "snap" on nudges, satisfying
  particle bursts and number pops on big resolves, a subtle screen-warp shader on a huge turn.

## Steerable builds (Pillar 4)

- Manipulation *is* per-turn steering. Between fights: affinity-weighted rewards, a pity meter,
  and cheap face-crafting so you can reliably build toward an archetype (attack-stack,
  block-turtle, symbol-engine, etc.).

## MVP scope

- 1 character, a starting pool + ~50 collectable faces/dice across 3 archetypes, the full
  manipulation toolkit + face-crafting, ~10 encounters + boss.
- Hold-to-preview + readable targeting (core; build early).
- 3 ascension tiers + daily seed + one endless gauntlet.

## Tech notes

- Deterministic seeded RNG + pure-function dice resolver (powers preview, dailies, ghost races).
- Dice physics can be *cosmetic* over a deterministic result (roll animation lands on the
  predetermined face) — keeps logic testable while looking physical.
- PixiJS/WebGL or a light 3D layer for dice; DOM for menus/glossary; Capacitor for iOS/Android;
  light backend for leaderboards + ghost seeds.

## Risks & open questions

- **Manipulation power creep** could trivialize randomness — budget must be tight and scale
  with difficulty; enemies get manipulation too at high ascension.
- **Analysis paralysis** from too many manipulation options — keep the toolkit small and clear;
  the preview helps here.
- **3D/physics cost on phones** — keep it lightweight or fake it over deterministic results.

## Why it's radically different

It swaps the deck for an *editable dice pool* and makes "cheating fate" the core verb. And
unlike the others, its defining design goal is the **difficulty ceiling** — the explicit fix
for the one flaw your notes gave the otherwise-excellent Dice of Kalma.
