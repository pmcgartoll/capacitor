# Tideturn — Vertical Slice Prototype

A self-contained mobile-first demo of **Tideturn**, a perfect-information tactical card battler where you stage an entire turn, see an exact ghost preview of the outcome, then commit to watch it resolve with juice.

## How to run

Open `index.html` directly in a browser (double-click or drag into Chrome/Safari), or serve the folder locally:

```bash
cd prototypes/01-tideturn
python3 -m http.server 8080
```

Then visit `http://localhost:8080` on desktop or your phone (same Wi‑Fi).

## What to try

1. **Read enemy intents** — each foe shows an icon, damage number, and arrow pointing at you (or their lane).
2. **Drag cards upward** onto enemies or lanes to stage them. Watch HP numbers shift green→red in the ghost preview; dying enemies fade out.
3. **Stage multiple cards** within your 3 energy — Guard for block, Strike/Cleave for damage, Undertow to weaken attacks, Push to reposition.
4. **Tap a staged chip** (top of bottom zone) to unstage and replan.
5. **Hold a card** (~0.4s, no drag) to read its full rules and solo-effect preview. Tap keywords for a glossary.
6. **Commit** — resolve with ink splashes, hit-stop, and screen shake on big combos. Enemies act in turn-order, then a new turn begins.
7. Win by killing all enemies, or lose if HP hits 0. Use ↺ or **Play Again** to reset.

## Out of scope for this prototype

No map/run structure, card rewards, relics, shop, ascension, daily seeds, or multiple battles. This is a single scripted encounter focused on the **plan → preview → stage → commit** loop.
