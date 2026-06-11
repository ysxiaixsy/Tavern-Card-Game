# Gwent — The Witcher 3 tavern game, for mobile

A faithful recreation of Gwent **as played inside The Witcher 3: Wild Hunt**,
built with Expo/React Native on top of a pure, deterministic TypeScript engine.
Hot-seat first, then vs-AI, then online play via Supabase room codes.

> Personal learning project. Game mechanics aren't copyrightable, but all card
> names referencing CDPR's world ship with placeholder programmatic art only,
> and this is strictly non-commercial. See `docs/BRIEF.md` for the full spec.

## Status

| Milestone | State |
| --- | --- |
| M1 — game engine, tests, simulator | ✅ done (81 tests green) |
| M2 — hot-seat UI in Expo | next |
| M3 — AI opponent | planned |
| M4 — online play (Supabase) | planned |
| M5 — polish, deck builder, NG/ST factions | planned |

## Getting started

```sh
npm install
npm test            # engine test suite (vitest)
npm run typecheck   # strict TypeScript
npm run simulate    # watch two bots play a full match in the terminal
npm run simulate my-seed   # any seed string reproduces the same game
```

## What to verify manually after M1

1. `npm test` — all suites pass, including the 100-game determinism replay.
2. `npm run simulate gwent-demo` — read the log and sanity-check the rules:
   spies land on the enemy side and draw 2; the Crones muster as a trio;
   weather floors rows to 1 and Clear Weather lifts it; the Monsters player
   keeps one random unit between rounds; gems tick down; best-of-3 ends.
3. Skim `src/engine/data/cards.ts` for card stats you want corrected — values
   are approximate and marked for verification against the Witcher wiki.

## Layout

```
src/engine/          pure rules engine (no React/Node imports — runs in Deno too)
  data/              card database + starter decks
  __tests__/         vitest suites incl. the 9 named scenarios from the brief
scripts/simulate.ts  headless AI-vs-AI runner
docs/BRIEF.md        the build brief (source of truth for rules)
```
