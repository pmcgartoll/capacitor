# Instructions for agents working in this repo

## Git workflow: commit directly to main

Per the repo owner's explicit instruction (2026-07-08): **do not create feature branches or
pull requests**. Commit your work directly on `main` and push after each logical commit.

- Every push to `main` auto-deploys `prototypes/` to GitHub Pages
  (https://pmcgartoll.github.io/capacitor/) via `.github/workflows/deploy-pages.yml`,
  which is how the owner tests on their phone. Keep `main` in a working state.
- Use clear, descriptive commit messages; one commit per logical change.

## Testing the prototypes

The prototypes are zero-dependency static HTML/CSS/JS in `prototypes/`. Before pushing:

- Syntax-check any changed JS with `node --check`.
- Test in a mobile viewport (390x844) with Playwright, in **both Chromium and WebKit** —
  WebKit is Safari's engine and the owner plays on an iPhone; it has caught bugs that
  Chromium testing missed (e.g. a drag bug that only manifested through pointer-move
  event streams). Exercise real interactions (drags, holds, taps), not just page load;
  watch for console/page errors and inspect screenshots.
