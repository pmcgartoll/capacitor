# 03 · Pulse — the real-time, one-thumb, shader-forward deckbuilder

> **Core verb: FEEL.** A deckbuilder that trades strict turns for a flowing, real-time-ish
> rhythm of card plays, built entirely around Balatro-grade juice and true one-thumb play.

## One-line pitch

Cards flow into your hand on a cadence; you tap and swipe to unleash them in real time against
telegraphed enemy attacks — a fast, tactile, gorgeously juicy roguelite that plays great with
a single thumb on the train.

## The fantasy

You're a conduit channeling raw energy in a duel of momentum. It feels closer to a fighting-
game combo or a rhythm game than to a spreadsheet — but every action is still a *card*, and
between fights you still *build a deck*. The hook is flow-state satisfaction.

## Which notes this answers

- **Balatro (satisfying shaders):** juice is the *entire point* — this is the "make it feel
  incredible" concept. Every tap, hit, and combo is a small shader/particle celebration.
- **Dice of Kalma (mobile-native, one-handed):** designed for one thumb from frame one;
  short, pick-up-and-play sessions.
- **Balatro/Kalma (don't guess):** even in real time, a **hold-to-aim** gesture slows time and
  previews the shot's damage/effect before you release — no blind swings.
- **Slice & Dice (who attacks whom):** enemy attacks are **telegraphed as filling bars +
  arrows**; you can *see and react* rather than parse a static board.
- **StS (art):** a bold neon/synthwave identity so it never looks like programmer art.

## Core loop

1. **Fight (real-time, ~60–120s):**
   - Cards **auto-flow** into a small hand on an energy cadence (a resource bar refills over time).
   - **Tap** a card to play it; **swipe/drag** onto an enemy to aim; **hold** to slow time and
     preview before release.
   - Enemies wind up attacks (visible fill bars); you interrupt, block, dodge (swipe), or race
     to burst them down. Think active-time-battle meets deckbuilder.
2. **Reward:** grab cards/relics with steer tools (affinity-weighted, pity meter).
3. **Node map:** short branching run; escalating encounters + bosses.
4. **Optional "flow bonus":** clean, well-timed play builds a multiplier — the skill ceiling.

## Signature mechanics

- **Time-dilation aim (hold-to-preview, real-time flavored).** Holding a card slows the world
  to a crawl and shows exact numbers/AoE; release to fire at full speed with full juice. This
  is the Kalma preview idea adapted to an action game — reflexes *and* clarity.
- **Cadence hand.** No discrete turns; energy and card-flow create a rhythm. Deckbuilding
  decisions become "what do I want cycling through my hands over time."
- **Reactive defense.** Swipe to dodge, tap-hold to block — attacks are telegraphed, so defense
  is a skill, addressing the "I couldn't tell who was attacking me" pain viscerally.
- **Flow multiplier.** Rewards precise, greedy-but-clean play; the ceiling that keeps experts
  engaged (directly targeting the "too easy" note).

## Steerable builds (Pillar 4)

- Fewer, punchier cards per run (an action game wants a tight kit), so each pick matters and
  reaching an archetype is inherently more reliable.
- Reward affinity weighting + a pity meter guarantee your archetype shows up.
- A **loadout "core"** you pick at the start seeds your build direction from turn one.

## Mobile-first UX

- **True one-thumb portrait.** All verbs are thumb-reachable: tap, swipe, hold. No two-hand
  gestures required.
- Enemy telegraphs are big and color-coded; incoming damage shown on your health globe.
- Because it's real time, sessions are short and interruptible (auto-pause on app background).

## Art & juice direction

- **Art:** **neon / synthwave / vaporwave** — glowing linework, bloom, chromatic aberration on
  big hits. A deliberately "premium arcade" identity, far from StS's look.
- **Juice (the star):** bespoke shaders per damage type, hit-stop + time-dilation on crits,
  screen shake tuned to feel good not nauseating, haptics on every impact, a reactive
  synthwave soundtrack whose intensity tracks your flow multiplier. This is where the majority
  of early prototyping effort goes.

## Difficulty & replayability

- **Skill-expressive by nature:** timing/dodging create a high ceiling even before modifiers.
- **Ascension tiers** + faster enemy telegraphs for harder difficulties.
- **Daily gauntlet** (fixed seed, score by flow multiplier & time) → leaderboards.
- Short runs = high replay frequency, ideal for mobile retention.

## MVP scope

- 1 character/core, ~30 cards, ~8 enemies + 1 boss, the cadence + time-dilation-aim + reactive
  defense systems fully juiced.
- Flow multiplier + 3 ascension tiers + daily gauntlet.
- Nail the *feel* of a single fight before building breadth — this concept lives or dies on juice.

## Tech notes

- Needs a real-time game loop: **PixiJS + a lightweight ECS**, fixed-timestep sim with
  deterministic seeding so dailies/replays work despite real-time input.
- Heavy shader/particle budget — profile on mid-range phones early (this is the main tech risk).
- Haptics via Capacitor plugins; audio via WebAudio with an adaptive-music layer.
- Capacitor iOS/Android; offline-first; light backend for leaderboards.

## Risks & open questions

- **Real time vs. deckbuilder "thinky-ness":** risk of feeling shallow. Mitigation: time-
  dilation aim restores planning moments; deckbuilding depth lives between fights.
- **Performance:** the juice ambition is heavy on phones — must budget and test continuously.
- **Accessibility:** reflex demands can exclude players — offer a "tactical slow" assist mode
  that biases toward the time-dilation planning side.

## Why it's radically different

It abandons strict turns entirely. It's the answer to "what if a deckbuilder felt like a
juicy action/rhythm game you play with one thumb" — the Balatro-feel and Kalma-ergonomics
pillars pushed to their logical extreme.
