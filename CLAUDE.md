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

- **M1 ✅** engine + tests + simulator (all 9 named scenarios from the brief;
  Francesca/ST flows covered end-to-end in `factions.test.ts`).
- **M2 ✅** hot-seat UI (`src/ui/`): zustand store (`store.ts`) wraps the
  engine and inserts pass-the-phone privacy gates; ALL visuals live in
  `theme.ts`; play options derive from `view.legalMoves` — the UI never
  re-implements rules. Components only ever consume a `PlayerView`.
- **M3 ✅** AI in `src/ai/`: `chooseMove(view, difficulty)` — sees ONLY a
  PlayerView, deterministic (same view ⇒ same move). `normal.ts` holds the
  heuristics (card economy, spies-first, concede logic, weather nets);
  `hard.ts` re-ranks normal's shortlist with determinized rollouts (samples
  hidden zones, plays the round out with the normal policy via the real
  engine). The store runs the AI as p2 on a 600 ms timer loop.
- **Bonus ✅** all four factions playable: NG + ST card sets and starter
  decks (pulled forward from M5); faction picker per seat on Home.
- **Bonus ✅** leader variants: 4 per faction (16 total), data-driven via
  `LeaderAbilityId` (+ `leaderWeather`/`leaderHornRow`/`leaderScorchRow`).
  row_horn leaders place a `leader_horn_marker` pseudo-card in the horn slot
  that evaporates at round end (never enters a graveyard, never deck-legal).
  discard_draw (Destroyer of Worlds) enumerates complete moves: every hand
  pair × every distinct deck def — large but finite, per the no-mid-move-
  prompt rule.
- **Card scope:** base game ONLY — the DLC exclusion list lives in the
  cards.ts header (Skellige, O'Dimm/Darkness, Olgierd, Toad, Cow, Schirrú,
  and the four DLC leaders). Don't re-add them without asking.
- **Bonus ✅** deck builder (pulled forward from M5): faction/leader/cards
  chosen in `DeckBuilderScreen`, seat assignment in `GameSetupScreen`, Home
  is mode-only. Deck rules: W3's ≥22 units & ≤10 specials PLUS a project
  rule of 25–30 total cards (user decision; W3 itself has no max) —
  constants exported from engine/game.ts, validateDeck is the single source
  of truth. Custom decks persist via zustand persist + AsyncStorage
  (`gwent-app` key, customDecks only). All four starters are exactly 30
  cards and double as immutable builder templates.
- **M4 ✅** online play. Supabase project `ntzwhhezdwehuwwvlyip` (GWENT,
  ap-southeast-1). One edge function `gwent` with action routing
  (create_game/join_game/get_view/submit_move) — it imports `engine.js`, an
  esbuild bundle of src/engine produced by `npm run sync:engine` (regenerate
  + redeploy whenever the engine changes). Tables: games (participant
  SELECT only), game_states (NO RLS policies — service-role only; holds the
  full GameState; pre-join it holds a `{lobby:true,decks}` payload), moves
  (append-only log). Optimistic concurrency via games.version. Client:
  src/online/ + OnlineScreen (anonymous auth persisted in AsyncStorage,
  Realtime postgres_changes on the games row + poll + foreground refetch,
  `lastOnlineGame` persisted for resume). BattleScreen/MulliganView are
  presentational and shared by local and online play. E2E:
  `npm run smoke:online`. NOTE: "Allow anonymous sign-ins" must be ON in
  the dashboard (auth config is not reachable via MCP/SQL).
- **M5** polish: animations (Reanimated), sound, settings.
