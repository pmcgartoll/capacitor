# Design Principles (distilled from genre notes)

Before the individual concepts, this is the shared "north star" — the lessons pulled
straight out of your notes on the games that inspired this project. Every idea in this
folder is scored against these principles.

## The five inspirations, and the single lesson each teaches us

| Game | What it nails | What frustrates | Lesson we steal |
| --- | --- | --- | --- |
| **Slay the Spire** | The genre's foundation. Combat *feels* good — satisfying attack animations and effects. | Art style feels amateurish / programmer-art. | Keep the deep turn-based combat loop, but **invest in a distinctive, cohesive art direction** so it doesn't read as amateur. |
| **Balatro** | Shader work makes even simple actions feel juicy and satisfying. | You *guess* at your outcome — you don't know your score before committing. | **Juice everything**, but pair it with **outcome previews** so satisfaction comes from mastery, not luck. |
| **Luck be a Landlord** | Fun symbol-synergy engine building. | You only pick 1 of 3 symbols out of ~25 in play; you often can't get the one piece your build needs. | **Let players steer toward a build.** Reduce "dead" RNG and give tools to reliably assemble synergies. |
| **Slice & Dice** | Deep, fun tactical dice combat. | Poor mobile ergonomics — hard to read rules, hard to see who attacks whom, endless hover / press-and-hold. | **Design for the thumb first.** Targeting and rules must be legible at a glance, without hovering. |
| **Dice of Kalma** | Best-in-class mobile UX, clearly built mobile-first. Holding the play button to preview damage is brilliant. | Too easy — beat all 25 rounds on the first try. | **Mobile-native interactions + hold-to-preview**, but ship a **real difficulty ceiling** and long-tail replayability. |

## The seven pillars every concept must honor

1. **Mobile-first, thumb-first.** Designed for one-handed portrait play from the ground
   up (not a PC port). Primary actions live in the bottom third of the screen. No mechanic
   may *require* hover, tiny tap targets, or long press to be understood.

2. **Hold-to-preview everything ("no guessing").** Any action with an outcome —
   damage, score, board state, triggers — can be previewed by holding before committing.
   Satisfaction should come from *planning a great turn and watching it land*, not from
   hoping. This is the Kalma play-button idea generalized to the whole game.

3. **Legible targeting & intent.** At a glance you can always answer: *who is attacking
   whom, for how much, and what happens if I do nothing?* Explicit arrows/lines, telegraphed
   enemy intents, and damage numbers on the target — never buried in tooltips.

4. **Steerable builds (RNG you can bend).** RNG creates variety, but the player must have
   reliable levers — drafting, crafting, banking, rerolls, pity/wish systems — to assemble
   an intended synergy. Losing to a smarter opponent = fine. Losing because you never saw
   your key piece = a design bug.

5. **Juice as a first-class feature.** Shaders, screen shake, hit-stop, particles, and
   sound are not polish added at the end — they are core to the feel and are prototyped
   early. A single hit should feel *good* even in a greybox build.

6. **A real difficulty curve + long tail.** The base run should be beatable and welcoming,
   but ascension-style modifiers, daily seeds, and/or competitive modes must give
   experienced players a genuine ceiling. "Beat it first try and never returned" is failure.

7. **Rules readable in-context.** Any keyword, symbol, or card explains itself where it
   sits (tap-to-expand glossary, plain-language reminder text). New players should not need
   a wiki; the notes on Slice & Dice's opacity are the thing to avoid.

## Tech context

The repo README says `capacitor`, so the assumed target is a **web tech stack wrapped with
[Capacitor](https://capacitorjs.com/) for iOS/Android** (plus web/PWA). That favors:

- A web renderer with strong 2D/shader support (e.g. **PixiJS** or a WebGL canvas) for the
  juice pillar, with UI in the DOM/framework layer where it helps accessibility and touch.
- Deterministic, seed-driven game logic in TypeScript so runs are replayable, shareable,
  and testable, and so "daily seed" and async modes are cheap to build.
- Offline-first single-player; any online mode (leaderboards, async duels) layered on top.

## How to read the concept briefs

Each of `01`–`04` is a **radically different** take on "deck/engine builder," not a reskin.
They differ in their core verb:

- **01 · Tideturn** — *plan*. Perfect-information tactical card combat.
- **02 · Sigil Forge** — *forge*. A synergy engine you deliberately craft.
- **03 · Pulse** — *feel*. Real-time, shader-forward, one-thumb combat.
- **04 · Kismet** — *press your luck*. Dice-manipulation roguelike with a real ceiling.

Every brief maps itself back to the pillars above and to your original notes.
