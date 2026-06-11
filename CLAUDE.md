@AGENTS.md

# Gwent (The Witcher 3) — mobile recreation

Faithful recreation of the Gwent minigame **as it appears inside The Witcher 3**
(NOT the standalone GWENT — different rules). Full spec: [docs/BRIEF.md](docs/BRIEF.md).
Read it before changing rules; it is the source of truth over memories of the game.

## Commands

- `npm test` / `npm run test:watch` — engine test suite (vitest)
- `npm run typecheck` — strict tsc
- `npm run simulate [seed]` — headless AI-vs-AI game with readable log
- `npm start` — Expo dev server (UI work, M2+)

## Architecture (non-negotiable)

- `src/engine/` is a **pure, dependency-free state machine**: no React/RN/Node/Deno
  imports, no `Math.random()`, no `Date.now()`. It must run unchanged under Metro
  (the app) and Deno (Supabase Edge Functions, M4).
- Engine-internal imports use explicit `.ts` extensions (Deno compat;
  `allowImportingTsExtensions` is on). If Metro ever chokes on them, fix the
  resolver in metro.config.js — do NOT strip the extensions.
- **Determinism:** all randomness flows through `rngState` inside `GameState`
  (`src/engine/rng.ts`). Same seed + same move list ⇒ deep-equal states.
  The 100-game replay test in `determinism.test.ts` enforces this — never break it.
- `GameState` is plain JSON (persisted as jsonb in M4). Moves are serializable
  JSON carrying the acting player. Multi-step interactions (medic chains, the
  Scoia'tael first-player choice) run through `state.pendingChoice` — the flow
  is documented at the top of `src/engine/types.ts`.
- Hidden information: only ever expose `PlayerView` (via `getView`) to UI/AI/
  network clients. The AI must never receive a raw `GameState`.

## Card data

`src/engine/data/cards.ts` — stats are **approximate**, flagged for verification
against the Witcher wiki (`// VERIFY:` comments mark known uncertainty).
Placeholder art only; never reference CDPR assets (see IP note in the brief).

## Milestone status

- **M1 ✅** engine + 81 tests + simulator (this includes all 9 named scenarios
  from the brief; Francesca's auto-draw inside `createGame` is the one branch
  without end-to-end coverage — a legal Scoia'tael deck needs M5 card data).
- **M2 (next)** hot-seat UI: portrait board, card carousel, pass-the-phone screen.
- **M3** heuristic AI over `PlayerView` (`chooseMove(view, difficulty)`).
- **M4** Supabase online play (Edge Functions run this same engine).
- **M5** polish + Nilfgaard/Scoia'tael card data, deck builder.
