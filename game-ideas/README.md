# Deckbuilder game ideas

Four **radically different** takes on the "deck/engine builder" genre, plus the shared design
thinking behind them. Each concept is a distinct core verb — not a reskin of the others — and
each is scored against a shared set of pillars distilled from notes on the games that inspired
this project (Slay the Spire, Balatro, Luck be a Landlord, Slice & Dice, Dice of Kalma).

## Start here

- **[00 · Design Principles](./00-design-principles.md)** — the lessons pulled from each
  inspiration and the seven pillars every concept honors. Read this first.

## The four concepts

| # | Concept | Core verb | The one-liner | Chiefly answers |
| --- | --- | --- | --- | --- |
| [01](./01-tideturn.md) | **Tideturn** | *Plan* | Perfect-information tactical card combat — see the whole turn before you commit. | StS depth · anti-guessing · targeting clarity |
| [02](./02-sigil-forge.md) | **Sigil Forge** | *Forge* | A synergy engine you deliberately craft — steer RNG toward the build you want. | Luck be a Landlord's "can't reach my build" |
| [03](./03-pulse.md) | **Pulse** | *Feel* | Real-time, shader-forward, one-thumb juice-fest. | Balatro-feel · Kalma one-handed play |
| [04](./04-kismet.md) | **Kismet** | *Press your luck* | Editable dice pool you bend, with a difficulty ceiling that bites. | Kalma's "too easy" · dice-combat done for mobile |

## How they differ at a glance

- **Substrate:** cards (01) · symbols/engine (02) · cards in real time (03) · editable dice (04)
- **Pace:** deliberate turns (01, 02) · real-time flow (03) · tactile turns (04)
- **Signature feature:** turn-staging preview (01) · the forge/steering toolkit (02) ·
  time-dilation aim (03) · the manipulation toolkit + ascension ceiling (04)
- **Primary risk:** does full info reduce tension (01) · does steering get too easy (02) ·
  phone performance & depth (03) · manipulation power creep (04)

## Shared foundations (why they can share a codebase)

All four assume the same tech spine (see `00`): a **deterministic, seed-driven TypeScript game
engine** wrapped with **Capacitor** for iOS/Android + web, with **PixiJS/WebGL** for juice and
DOM/framework UI for touch accessibility. Deterministic logic is what makes hold-to-preview,
daily seeds, and async/leaderboard modes cheap across every concept.

## Suggested next step

Pick the concept whose *core verb* excites you most and build a **single-fight vertical slice**
that proves its signature feature and its juice — that's the fastest way to feel whether the
idea sings on an actual phone.
