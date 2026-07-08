# Prototypes

Playable **vertical slices** of the four deckbuilder concepts in [`../game-ideas/`](../game-ideas/).
Each one exists to let you *feel the core gameplay loop on a phone* — it is intentionally **not**
the full game (no run map, meta progression, full content, or backend).

| # | Concept | Core verb | The slice proves | Folder |
| --- | --- | --- | --- | --- |
| 01 | **Tideturn** | *Plan* | Ghost-preview + turn-staging: stage a whole turn on a 3-lane grid, see the exact outcome, commit. | [`01-tideturn/`](./01-tideturn/) |
| 02 | **Sigil Forge** | *Forge* | Spin a reading-order symbol board with hold-to-preview, then **steer** your build (targeted draft, fusion, wish). | [`02-sigil-forge/`](./02-sigil-forge/) |
| 03 | **Pulse** | *Feel* | Real-time one-thumb combat: hold-to-slow-time aim, swipe to dodge telegraphs, chase a flow multiplier. | [`03-pulse/`](./03-pulse/) |
| 04 | **Kismet** | *Press your luck* | Roll a custom dice pool, sculpt it with reroll/nudge/lock, hold-to-preview the exact result, resolve. | [`04-kismet/`](./04-kismet/) |

## How to run

Everything is **zero-build, zero-dependency vanilla HTML/CSS/JS** and works fully offline.

- **On your phone, no computer needed (recommended):** this folder is auto-deployed to GitHub Pages
  by [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) on every push to
  `main`. Open **`https://pmcgartoll.github.io/capacitor/`** in your phone's browser and tap a
  concept. Use "Add to Home Screen" for a fullscreen, app-like feel.
  *Note: GitHub Pages on a **private** repo requires a paid GitHub plan — either make the repo
  public or upgrade; the workflow itself needs no other setup.*
- **Quickest on a computer:** open [`index.html`](./index.html) (this folder's landing page) or any
  prototype's own `index.html` directly in a browser.
- **On your phone via your own computer:** serve this folder over your local network and open it on
  the device:

  ```bash
  cd prototypes
  python3 -m http.server 8080
  # then on a phone on the same Wi-Fi, visit http://<your-computer-ip>:8080
  ```

Then tap a concept from the landing page. Designed for **portrait**; also usable with a mouse on desktop.

## Shared conventions

All four slices deliberately share the design constraints from
[`../game-ideas/00-design-principles.md`](../game-ideas/00-design-principles.md):

- **Mobile-first, thumb-first** portrait layout; Pointer Events so touch *and* mouse both work; large tap targets.
- **Hold-to-preview ("no guessing")** — the preview reuses the same deterministic resolver as the real action.
- **Deterministic, seed-driven logic kept separate from rendering** (a small seeded RNG + pure resolver per game).
- **Juice as a first-class feature** — particles, hit-stop, screen shake, number pops, and guarded haptics
  (`navigator.vibrate`), all done with canvas/CSS/Web Audio (no external asset files).

## Status / scope

These are prototypes to evaluate feel and the signature mechanic of each concept — not shippable builds.
Out-of-scope items (run maps, rewards, ascension ladders, daily seeds, leaderboards, full content rosters)
are listed in each prototype's own `README.md`.
