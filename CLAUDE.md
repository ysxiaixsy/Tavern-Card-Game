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
- **Card scope (2026 decision — reversed the earlier base-only rule):** the
  COMPLETE in-game W3 Gwent pool, base + Hearts of Stone + Blood and Wine —
  **all phases DONE.** Phase 1 (HoS neutrals/faction cards + Son of Medell),
  Phase 2 (Cow + Bovine = Summon-Avenger system), Phase 3a (Skellige roster,
  Crach `reshuffle_graveyards`, round-3 perk, Kambi→Hemdall), **3b** (Skellige
  Storm — WeatherKind `'storm'`, halves ranged+siege ceil/min1; King Bran
  `halve_weather` softens weather to a halving for his side — Skellige has
  exactly 2 leaders, now complete), **3c** (Mardroeme: bespoke CardType +
  `CardDef.transformsTo`, transforms Berserker→Vildkaarl 14 and Young
  Berserker→Young Vildkaarl 8 on BOTH sides), **3d** (the 3 HoS leaders:
  Eredin the Treacherous = passive `spy_double_passive`; Francesca Hope =
  `realign_agile`; Emhyr Invader = passive `restore_random_passive` for BOTH
  players — both passives cancellable via White Flame). Mechanics added across
  phases: `scorch_row`, `summonsGroup`, `summonAvenger`+`pendingSummons`,
  `'storm'` weather, `halve_weather`, `'mardroeme'` type + `transformsTo`,
  `spy_double_passive`, `realign_agile`, `restore_random_passive`. 165 tests.
  Many Skellige/Berserker stats still carry `VERIFY` (fandom blocks fetch).
- **Assets/IP — card art pipeline LIVE:** real CDPR card faces wire in for
  PRIVATE, non-distributed use only and are kept OUT of git. Drop PNGs in
  `assets/cards/<Faction>/` (named `<Faction>-NNN-CardName.png`) + `leaders/`
  (`<base><1..N>.png`), then `npm run optimize:art` (sharp → 700px WebP, ~668MB
  to ~16MB) and `npm run gen:art` (`scripts/gen-card-art.ts` matches filename →
  defId by normalized name; OVERRIDES table for spelling stragglers; prints a
  coverage report). **`assets/cards/` and the populated `src/ui/cardArt.ts` are
  COMMITTED** (user decision 2026-06-19) so EAS cloud builds ship the art — the
  repo has NO remote; if one is ever added keep it PRIVATE (CDPR IP). `CardView`
  renders the WebP when `CARD_ART[defId]` exists (live effective-strength badge
  overlaid top-left since the printed number is static) else the programmatic
  frame. Current coverage: 142/171 deckable; no-art fallbacks = all Skellige
  (no folder yet), the new HoS/BaW neutrals (Gaunter/Olgierd/Cow/Toad/Schirru),
  Son of Medell, Katakan — these keep the programmatic frame until art exists.
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
  the dashboard (auth config is not reachable via MCP/SQL). Lifecycle:
  one open room per host (create_game retires the caller's waiting rooms),
  cancel_game action for the lobby's Cancel button, and migration 0002's
  pg_cron job `gwent_cleanup_hourly` expires waiting>2h / stale-active>48h
  / finished>7d (cascade cleans game_states + moves).
- **M5 ✅** polish: SettingsScreen + persisted `prefs` (animations, haptics,
  confirmPass, aiSpeed) in the store; `src/ui/feedback.ts` centralizes haptics
  (expo-haptics) gated by the pref, with `// sound:` seams where authored audio
  would slot in (sound itself out of scope — placeholder-only project, no
  assets authored); `src/ui/components/anim.tsx` has `Appear`/`Pulse` built on
  RN's Animated (not Reanimated — zero-config, bundles cleanly, collapses to
  instant when animations are off). Wired into Home/Result/Privacy/Battle.
  All four milestones + bonuses now complete.
- **Safe area:** App.tsx wraps in `SafeAreaProvider`; Root uses
  `react-native-safe-area-context` SafeAreaView with all edges so the Android
  nav bar / status bar never cover controls. Don't go back to manual
  status-bar padding.
- **Card drag:** "pull up to play" in `HandBar` (`DraggableHandCard`) on core
  PanResponder + Animated — NOT Reanimated. Reanimated 4 was tried and
  removed: its worklet Babel plugin isn't wired here (no resolvable
  babel-preset-expo / worklets plugin) and a misconfig crashes the battle
  screen, unverifiable without a device. If revisiting, confirm
  `react-native-worklets/plugin` is in the Babel config first.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
