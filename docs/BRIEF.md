# Build Brief: The Witcher 3's Gwent, for Mobile

## What you are building

A faithful mobile recreation of **Gwent as it appears inside The Witcher 3: Wild Hunt** — the in-game tavern minigame. NOT the standalone GWENT game (completely different rules; do not import any of its mechanics).

Three play modes, built in this order:

1. **Hot-seat** — two players pass one phone back and forth
2. **Vs AI** — the authentic Witcher 3 experience (in the game, Gwent is always vs an NPC)
3. **Online vs a friend** — via Supabase free tier, room-code matchmaking

Fidelity to the Witcher 3 ruleset is the top priority. Where this brief specifies a rule, implement it exactly as written, even if it conflicts with your memory of the game — but note the discrepancy in a comment so I can verify. For card *stat values*, prefer your knowledge of the actual W3 cards and flag uncertainty in comments.

## Tech stack (fixed — do not substitute)

- **App:** Expo (React Native) + TypeScript in strict mode. Must run in Expo Go on a physical phone.
- **Game engine:** pure, dependency-free TypeScript in `src/engine/`. Zero imports of React, React Native, or Node APIs. It must run unchanged in both Metro (the app) and Deno (Supabase Edge Functions).
- **Client state:** Zustand or `useReducer` — keep it simple.
- **Backend (Milestone 4 only):** Supabase free tier — Postgres, Realtime, Edge Functions, anonymous auth. Managed with the Supabase CLI (`supabase/migrations/`, `supabase/functions/`).
- **Tests:** Vitest for the engine.
- No paid services anywhere.

## Architecture requirements (non-negotiable)

**1. Engine/UI separation.** The engine is a pure state machine:

```ts
createGame(config: GameConfig, seed: string): GameState
getLegalMoves(state: GameState, player: PlayerId): Move[]
applyMove(state: GameState, move: Move): GameState   // pure; throws GwentError on illegal moves
getView(state: GameState, player: PlayerId): PlayerView  // hides opponent hand + both deck contents
isTerminal(state: GameState): MatchResult | null
```

**2. Determinism.** A single seeded PRNG lives inside `GameState`. ALL randomness draws from it: deck shuffles, the coin flip, the Monsters faction's kept unit, random hand-peeks. Same seed + same move sequence ⇒ deep-equal final state. This is what makes online sync, server validation, and replays trivial — do not break it.

**3. Moves are serializable JSON.** Examples: `{type:'PLAY_CARD', cardInstanceId, row?, targetInstanceId?}`, `{type:'PASS'}`, `{type:'USE_LEADER', ...}`, `{type:'MULLIGAN', cardInstanceIds}`. All choices a card requires (decoy target, medic revive pick, agile row choice) are part of the move payload — the engine never prompts mid-move; the UI gathers choices and submits a complete move. Medic chains are sequential moves: playing a medic puts the game into a `state.pendingChoice` that only that player can resolve with a follow-up move. Document this flow.

**4. Information model.** Hidden: each player's hand contents, both decks' contents and order. Public: the board, both graveyards (fully browsable), gem counts, hand counts, deck counts, active weather, leaders used. `PlayerView` must enforce this — the AI also only ever sees a `PlayerView`, never full state.

## The rules (implement exactly)

### Setup
- A deck = exactly 1 leader card, **at least 22 unit cards**, **at most 10 special cards**. Cards are either faction-locked or neutral.
- Both players draw 10 cards. Each may mulligan up to 2 (returned card goes back into the deck, deck reshuffled, replacement drawn). **There is no draw step — these 10 cards must last the entire match.** This is the core of Gwent: card economy beats raw points.
- Coin flip decides who plays first in round 1 (Scoia'tael perk overrides — see perks).
- For rounds 2 and 3, the winner of the previous round plays first; after a tied round, the same player who led keeps leading. *(I'm ~80% sure on this — verify against the game/wiki; it's a one-line constant either way.)*

### Round and match flow
- On your turn: play exactly one card, use your leader, or **pass**. After passing you take no further actions this round; your opponent then takes consecutive turns until they also pass.
- A player with an empty hand is force-passed.
- Round ends when both have passed. Compare total strength across all your rows. Higher total wins the round; the loser loses 1 gem. **A tie costs both players a gem** (Nilfgaard exception below).
- Each player starts with 2 gems. At 0 gems you lose the match. If both reach 0 simultaneously, the match is a draw (UI offers rematch).
- Between rounds: every board unit goes to its **owner's** graveyard, all weather clears, hands carry over untouched. (Monsters exception below.)

### Board
- Per player, 3 rows: **Close Combat (melee)**, **Ranged**, **Siege**. Each row has one Commander's Horn slot. One shared weather area covers both players.
- Every unit declares its row. **Agile** units choose melee OR ranged on play (never siege); if returned to hand via Decoy, the row is chosen again on replay.

### Strength calculation — apply per unit, in this exact order
1. Start from printed strength. **Hero units are immune to every modifier below; their strength never changes.**
2. **Weather:** if the unit's row is under weather, its strength becomes 1.
3. **Tight Bond:** if *n* same-named bond units share a row, each becomes current × *n*.
4. **Moral Boost:** +1 per moral-boost unit in the same row (a moral-boost unit doesn't buff itself).
5. **Horn:** ×2 if the row is horned. **Doubling applies at most once per row** regardless of how many horn sources (Commander's Horn card + a horn-ability unit do not stack).

Worked example to encode as a test: a row under Biting Frost containing three bonded 6-strength units, one moral-boost unit, and a horn ⇒ each bonded unit = ((1 × 3) + 1) × 2 = **8**.

### Special cards
- **Biting Frost** → all melee rows. **Impenetrable Fog** → all ranged rows. **Torrential Rain** → all siege rows. Weather hits **both** players' matching rows. Playing a duplicate weather has no additional effect.
- **Clear Weather:** removes all active weather (cards go to their owners' graveyards), then goes to the graveyard itself.
- **Commander's Horn:** placed on one of YOUR rows' horn slot; one per row.
- **Scorch (special card):** destroys ALL non-hero units currently tied for the highest strength on the **entire board, both sides** (ties die together). Heroes are ignored entirely. No effect if the board has no non-hero units.
- **Decoy:** swap with a non-hero **unit** on your side of the board; that unit returns to your hand and the Decoy takes its spot at 0 strength (it goes to your graveyard at round end). Cannot target heroes or special cards. **Enemy spies sitting on your side ARE valid targets** — picking up an opponent's spy and replaying it as your own is the classic play; make sure this works.

### Unit abilities
- **Hero:** immune to all effects, positive and negative — weather, horn, bond, moral boost, scorch, decoy, medic revival.
- **Medic:** on play, choose any non-hero **unit** from your own graveyard and play it immediately, with full effects (medics chain, revived spies draw cards, revived muster units muster). Skipping is allowed only if the graveyard has no legal target.
- **Spy:** played onto the matching row on the **opponent's** side — its strength counts toward THEIR total — and you immediately draw 2 cards from your deck (or as many as remain).
- **Muster:** on play, immediately also play every card sharing its muster group from your hand **and** your deck onto their rows (e.g., Nekkers, Arachas, the Crones — model this with a `musterGroup` field, since the Crones have different names but one group).
- **Tight Bond / Moral Boost / Horn (unit) / Agile:** as defined in the strength section.
- **Scorch (unit ability)** — e.g., Villentretenmerth: on play, IF the opponent's Close Combat row totals 10 or more, destroy the strongest non-hero unit(s) in that row. The scorch unit itself stays on your row as a normal unit.

### Faction perks
- **Northern Realms:** draw 1 card from your deck each time you win a round.
- **Nilfgaard:** wins tied rounds (NG vs NG tie: both lose a gem).
- **Monsters:** after each round, one random Monsters unit of yours stays on the board into the next round.
- **Scoia'tael:** you decide who goes first in round 1.

### Leaders
Once per match, on demand (a button on the board). Make leader abilities data-driven. Implement these four for v1 — verify exact names/effects against the Witcher wiki and correct the data if I have any wrong; they're one-line fixes:
- **Foltest (Northern Realms):** play an Impenetrable Fog from your deck immediately.
- **Emhyr (Nilfgaard):** look at 3 random cards in your opponent's hand.
- **Eredin (Monsters):** restore a unit from your graveyard to your hand.
- **Francesca (Scoia'tael):** draw an extra card at the start of the match (auto-trigger, not on-demand).

## Card data

Schema in `src/engine/data/cards.ts`:

```ts
{ id, name, faction: 'neutral'|'northern_realms'|'nilfgaard'|'monsters'|'scoiatael',
  type: 'unit'|'hero'|'weather'|'horn'|'scorch'|'decoy'|'leader',
  row?: 'melee'|'ranged'|'siege'|'agile', strength?: number,
  abilities: Ability[], musterGroup?: string, maxCopiesPerDeck?: number }
```

- Ship the full **neutral** set plus enough **Northern Realms** and **Monsters** cards for two legal decks (≥22 units each), with values approximated from The Witcher 3. Header comment: "Stats approximate — verify against the Witcher wiki." Nilfgaard and Scoia'tael card data come later, but the engine must support all four faction perks now.
- The starter data must include the iconic interactions: spies, at least one medic, a tight-bond trio, a muster group, several heroes, and a unit-scorch card — so every mechanic is reachable from the two v1 decks.
- **Art: placeholder only.** Programmatic card frames — faction color, strength badge, row icon, ability icons, name text. Do NOT use or reference assets from the game. Keep all visuals in one themable module so custom art can be dropped in later.

## AI opponent (Milestone 3)

A heuristic agent over `getLegalMoves`, exposed as `chooseMove(view: PlayerView, difficulty): Move`. It sees only `PlayerView` — no cheating. Hard requirements:

- It understands **card economy**: the goal is winning 2 of 3 rounds with 10 cards, not maximizing points. It must be able to concede a lost round cheaply and avoid overcommitting when ahead.
- Opening priorities: spies first, then muster enablers, then mid-value units; heroes, scorch, and medics held for contested rounds.
- Pass logic: pass when (a) opponent passed and you lead, (b) the deficit can't be overcome at acceptable card cost, (c) you're baiting while holding card advantage.
- Weather valued as (opponent's row loss − own row loss), played above a threshold; medic priority: revive spy > scorch-bait > biggest unit.
- Difficulties: **Easy** = greedy points, naive passing. **Normal** = full heuristics. **Hard** = Normal plus shallow lookahead or random-rollout evaluation of candidate moves.

## Online multiplayer (Milestone 4) — Supabase free tier

A thin authoritative server: the **same TS engine** runs inside Edge Functions. Clients never possess the opponent's hidden information.

**Tables** (via `supabase/migrations/`):
- `games`: id, room_code (6 chars, unique), status ('waiting'|'active'|'finished'), player1, player2, current_player, version int, winner, created_at. RLS: participants may SELECT; no client INSERT/UPDATE.
- `game_states`: game_id PK/FK, state jsonb (full GameState — seed, hands, decks). RLS: **no client access at all**; service-role only.
- `moves` (optional but recommended): game_id, idx, player, move jsonb — append-only log for replay/debugging.

**Edge Functions** (Deno, importing `src/engine`):
- `create_game(deckId)` → server generates seed, shuffles, creates rows, returns room_code.
- `join_game(room_code, deckId)` → seats player2, deals, sets status active.
- `get_view(game_id)` → the caller's `PlayerView`.
- `submit_move(game_id, move)` → assert caller is current player → `applyMove` (engine throws on illegal) → persist state, increment `games.version`, append to log.

**Sync:** clients subscribe to Realtime postgres_changes on their `games` row; on a version bump they call `get_view`. Reconnect = same fetch on app foreground. **Auth:** `signInAnonymously()`, session persisted so identity survives restarts. No turn timers in v1; abandoned games expire by `created_at`.

## Mobile UI (Milestone 2 onward)

- Portrait. Top to bottom: opponent gems / hand count / deck count → opponent siege, ranged, melee rows → weather strip → your melee, ranged, siege rows → per-row totals and grand totals → your hand as a horizontal carousel → Pass button (with confirmation).
- Long-press any card → zoomed view with ability text. Tap either graveyard to browse it (both are public).
- Targeting flows: Decoy highlights valid targets; Medic opens a graveyard picker; Agile prompts a row choice; the leader button previews its ability before confirming.
- Hot-seat mode shows a "pass the phone" privacy screen between turns so hands stay hidden.
- Target 60fps. Animations (card play, scorch, weather) are Milestone 5 polish via Reanimated; instant transitions are fine in Milestone 2.

## Testing — Milestone 1 gate (no UI until all green)

Unit tests for every ability, plus these named scenarios:
1. The strength-order worked example above (frost + bond ×3 + moral + horn ⇒ 8).
2. Scorch kills all tied non-heroes across both sides; heroes untouched.
3. Decoy retrieves an enemy spy from your side; replaying it draws 2.
4. Medic chain: medic → revives medic → revives spy → both spy draws fire.
5. Muster pulls copies from hand AND deck.
6. All four faction perks, including NG winning a 0–0 tie and Monsters' kept unit persisting.
7. Pass lockout: after passing, only the opponent acts until round end.
8. Forced pass on empty hand; match ends at 0 gems; simultaneous 0–0 gems = draw.
9. Determinism: 100 random games — same seed + same move list ⇒ deep-equal states.

Also a headless simulator: `npm run simulate` plays AI vs AI and prints a readable turn-by-turn log.

## Milestones and process

**M1** engine + tests + simulator → **M2** hot-seat UI → **M3** AI opponent → **M4** online via Supabase → **M5** polish (deck builder, animations, sound, settings, Nilfgaard + Scoia'tael card data).

End every milestone with run instructions and a short "what to manually verify" checklist. Never advance with failing tests. Within a milestone, make reasonable judgment calls and note them — only stop to ask me if a decision would change the stack or the rules above. **Begin now with M1: lay out the engine's type definitions and the `applyMove` flow first, then implement with tests.**

## Out of scope — do not build

User accounts/profiles, rankings, public matchmaking beyond room codes, app-store deployment, the standalone GWENT ruleset, monetization.

## IP note

Personal learning project. Game mechanics aren't copyrightable, but Witcher names and art belong to CDPR — hence placeholder art and a single swappable theme/data module. Non-commercial; never distribute with their assets.
