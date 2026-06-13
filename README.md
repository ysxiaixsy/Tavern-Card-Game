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
| M1 — game engine, tests, simulator | ✅ done |
| M2 — hot-seat UI in Expo | ✅ done |
| M3 — AI opponent (easy/normal/hard) | ✅ done (97 tests green) |
| M4 — online play (Supabase room codes) | ✅ done |
| M5 — polish: settings, haptics, animations | ✅ done |
| Bonus — all four factions playable (NG + ST pulled forward from M5) | ✅ done |
| Bonus — leader variants (4 per faction, pickable per seat) | ✅ done |
| Bonus — full base-game card audit (no DLC: Skellige, O'Dimm, Olgierd, Schirrú, …) | ✅ done |
| Bonus — deck builder (pulled forward from M5): custom decks, persisted | ✅ done |

## Getting started

```sh
npm install
npm start           # Expo dev server — scan the QR with Expo Go on your phone
npm test            # engine test suite (vitest)
npm run typecheck   # strict TypeScript
npm run simulate    # watch two bots play a full match in the terminal
npm run simulate my-seed             # any seed string reproduces the same game
npm run simulate my-seed hard easy   # pick difficulties (p1, p2)
```

### Playing on the phone over USB (when Wi-Fi is unreliable)

Some routers/phones mangle the phone↔PC bundle download (symptoms: stuck at
"Bundling 99%", `JSBigFileString::fromPath` red screens). The cable route
bypasses all of it. One-time setup is already done on this machine
(platform-tools + an IPv4→IPv6 portproxy shim on port 18081, because
`expo start --localhost` binds IPv6-only on Windows). Per session:

```sh
# terminal 1
npx expo start --localhost
# terminal 2 — phone plugged in, USB debugging on
npm run usb
```

Re-run `npm run usb` after unplugging/replugging the phone.

## Online play (M4)

Room-code matchmaking on the Supabase free tier. The full GameState lives
ONLY on the server (`game_states` is service-role-only under RLS); clients
fetch `PlayerView`s from the `gwent` edge function, which validates every
move with the same engine the app runs. Sync = Realtime UPDATEs on your
`games` row + a slow poll + refetch-on-foreground (that's also reconnect;
"Resume game" on the online menu survives app restarts via the persisted
anonymous session).

Setup (one time):
1. `.env` ← `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   (see .env.example; already configured for the GWENT project).
2. Supabase Dashboard → Authentication → enable **Allow anonymous sign-ins**.
3. Deploy pieces (already done; for future changes):
   `npm run sync:engine` → apply `supabase/migrations/` → deploy
   `supabase/functions/gwent`.

Room lifecycle: **one open room per host** (creating a new room retires
your previous waiting one), the lobby's Cancel button deletes the room,
and an hourly pg_cron job expires the rest — waiting rooms after 2 h,
abandoned active games after 48 h without a move, finished games after
7 days (cascade removes their state + move log). Table growth is bounded
by live traffic; a thousand concurrent games is a few MB.

Verify the whole stack from a terminal: `npm run smoke:online` — two
anonymous users exercise room lifecycle (auto-retire + cancel), RLS and
seat-enforcement probes, then play a complete random match through the
real backend.

## Building an installable app (standalone APK)

Expo Go is dev-only. To get a real app you tap to install, build a standalone
binary with EAS (Expo's free cloud builder — no Android Studio needed). The
Supabase keys travel into the binary via `eas.json` build profiles (the anon
key is publishable; all authority is behind RLS + the edge function).

One-time:
```sh
npx eas-cli@latest login        # free Expo account
npx eas-cli@latest init         # links the project (writes extra.eas.projectId)
```
Build a shareable APK (sideload onto any Android phone):
```sh
npx eas-cli@latest build -p android --profile preview
```
EAS returns a download link; install the APK directly (no Play Store, no
Metro, works offline for hot-seat/AI, online needs internet). Bump
`android.versionCode` in app.json for each new build.

> **IP note:** this is a non-commercial fan project using CDPR's card names.
> Sideloading for yourself/friends is the intended use. Public store
> distribution under Witcher/Gwent branding is a trademark/copyright risk and
> would require rebranding (generic name, no CDPR card text) plus a privacy
> policy (anonymous accounts are stored in Supabase). The `production`
> app-bundle profile exists for that path but isn't recommended as-is.

## What to verify manually after M2 (on a phone, in Expo Go)

1. **Start a hot-seat game** — privacy screen appears before anyone sees cards.
2. **Mulligan** — swap 0–2 cards each; phone-pass gate between players.
3. **Board reads top-to-bottom**: opponent gems/hand/deck → their siege/ranged/
   melee → weather strip → your melee/ranged/siege → totals → hand → PASS.
4. **Play flows**: normal unit (one Play button), Celaeno Harpy (row choice),
   Commander's Horn (free-slot row choice), Decoy (valid targets glow gold —
   try stealing a spy the opponent planted on you), a Medic (undismissable
   graveyard picker; chain two medics), a spy (lands on the enemy side, you
   draw 2 — check the hand count).
4b. **Drag to play**: grab a hand card and pull it upward — a hint appears;
   release to play a simple card outright, or (for agile/horn/decoy) to open
   the same choice flow. Horizontal swipes still scroll the hand. Built on
   core PanResponder + Animated (no Reanimated), so it runs everywhere.
5. **Leader button** — preview text, confirm use (Foltest pulls fog from deck;
   Eredin lists graveyard units), chip greys out after use.
6. **Long-press any card** (hand, board, graveyard) → zoom with ability text;
   tap either graveyard chip to browse it.
7. **Pass** asks for confirmation; after passing, the other player takes
   consecutive turns; round banner appears on the privacy screen; forced
   passes are announced when someone runs out of cards.
8. **Finish a match** — result screen with per-round scores; Rematch reshuffles.

## What to verify manually (on the phone)

0. **Settings** (⚙️ on Home): toggle Animations / Haptics / Confirm-before-pass
   and set AI speed; all persist across an app restart. Turning Haptics off
   silences the vibration on plays/passes/results; Animations off makes every
   transition instant. "Confirm before passing" off makes PASS immediate.
1. **Home is mode-only**: Hot-seat, Versus AI, Deck builder, Online (M4).
   Tapping a mode opens the **setup screen**: assign a deck (starter or
   custom) to each seat, pick AI difficulty when relevant, start.
2. **Deck builder**: duplicate a starter or build new — pick faction (reset
   warning applies), pick one of the **four leader variants** (long-press
   for ability text), then use the +/− steppers. The sticky status bar
   enforces the rules live: 25–30 total, ≥22 units, ≤10 specials, copy
   limits per card. Save is disabled until legal. Custom decks **survive an
   app restart** (AsyncStorage) and appear on the setup screen.
3. Leader abilities worth trying: Queen of Dol Blathanna / Steel-Forged
   (on-demand row scorch), the Emperor (cancel the enemy leader before they
   use it), Red Riders / the Beautiful / the Siegemaster (free Commander's
   Horn on a row), King of the Wild Hunt (play from your graveyard), the
   Relentless (steal from the ENEMY graveyard), Destroyer of Worlds
   (discard 2, fetch any deck card via the two-step picker).
4. Scoia'tael with Daisy of the Valley: 11 starting cards plus the "who goes
   first?" choice before mulligans. Nilfgaard wins tied rounds.
2. Play Normal: it should open with spies, answer your big rows with weather
   or Scorch, revive spies with medics, and **concede hopeless rounds** rather
   than bleed cards — then beat you in round 3 with the cards it saved.
3. Easy should feel like a tavern rookie: dumps big bodies, never plays spies.
4. `npm run simulate x hard easy` in a terminal: hard should usually win 2-1,
   often by sacrificing round 1.

## What to verify after M1

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
src/ui/              Expo app: theme.ts (ALL visuals), store.ts (zustand),
  components/        card frames, board rows, hand carousel, modal sheets
  screens/           home, mulligan, battle, privacy gate, result
scripts/simulate.ts  headless AI-vs-AI runner
docs/BRIEF.md        the build brief (source of truth for rules)
```
