# Hush (web / hexagonal)

Agent-testable white-noise app with battery-aware volume reduction.

This is the **ports-and-adapters** build. The pure-SwiftUI app remains at
[`../ios/WhiteNoise/`](../ios/WhiteNoise/).

## Architecture

```
UI (index.html + css + js/ui)
        │
        ▼
PlaybackController  ← pure orchestration
        │
   ┌────┴────┐
   ▼         ▼
AudioPort  BatteryPort
   │         │
   ▼         ▼
WebAudio   WebBattery   ← Linux / Playwright / GitHub Pages
Native*    Native*      ← Capacitor / iOS (see native/)
```

- **`js/core/`** — pure policy + controller (Node-testable, no DOM)
- **`js/ports/`** — AudioPort / BatteryPort contracts
- **`js/adapters/`** — web implementations (+ native stub notes)
- **`js/ui/`** — view + wiring
- **`native/`** — how to swap in Capacitor / Swift adapters

Battery policy matches the Swift app:

| Battery (unplugged) | Volume vs your setting |
| ------------------- | ---------------------- |
| ≥ 30%               | 100%                   |
| 20–30%              | 80%                    |
| 10–20%              | 55%                    |
| &lt; 10%            | 30%                    |

Charging always restores full user volume.

## Run locally

```bash
cd hush
npx --yes serve -l 4173 .
# open http://127.0.0.1:4173/?sim=1
```

Safari has no Battery Status API — the **Battery simulator** panel appears automatically
when native battery is unavailable (or force with `?sim=1`).

## Test (Linux agents)

```bash
cd hush
npm test          # Node unit tests for core
npm run test:e2e  # Playwright Chromium + WebKit @ iPhone 13 viewport
```

E2E injects the controllable battery adapter (`?sim=1`) and asserts play + volume
reduction without needing a physical device.
