# capacitor

> "capacitor" is just a working codename for this project — not a technology choice.

A (planned) mobile-first deckbuilder game, targeting iOS/Android/web. The engine and
framework are still open (see the design notes for the constraints that matter).

## Game design ideas

Early ideation lives in **[`game-ideas/`](./game-ideas/)** — four radically different takes on
the deckbuilder genre plus the shared design principles behind them. Start with
[`game-ideas/README.md`](./game-ideas/README.md).

## Playable prototypes

Small, zero-dependency **vertical slices** of all four concepts live in
**[`prototypes/`](./prototypes/)** — each one lets you feel its core gameplay loop on a phone
(open [`prototypes/index.html`](./prototypes/index.html) to pick one). They are demos of the
signature mechanic, not full games.

## Hush (white noise)

Two builds of the same product:

| Build | Path | Notes |
| --- | --- | --- |
| **Web / hexagonal** | [`hush/`](./hush/) | Ports-and-adapters; Playwright-testable on Linux; Capacitor-ready native ports |
| **Native SwiftUI** | [`ios/WhiteNoise/`](./ios/WhiteNoise/) | Pure iOS app — open `WhiteNoise.xcodeproj` in Xcode |

Both share the same battery volume policy (trim below 30% / 20% / 10% while unplugged).
