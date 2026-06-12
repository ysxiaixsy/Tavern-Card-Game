-- GWENT online play — M4 schema.
--
-- Information model: the full GameState (seed, both hands, both decks) lives
-- ONLY in game_states, which has RLS enabled and NO policies — clients can
-- never read it, only the service-role edge function can. Clients see the
-- games metadata row (participants only) and fetch their PlayerView through
-- the edge function.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  player1 uuid not null,
  player2 uuid,
  current_player uuid,
  version int not null default 0,
  winner uuid,
  created_at timestamptz not null default now()
);

create table public.game_states (
  game_id uuid primary key references public.games (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Append-only move log for replay/debugging.
create table public.moves (
  game_id uuid not null references public.games (id) on delete cascade,
  idx int not null,
  player uuid not null,
  move jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, idx)
);

alter table public.games enable row level security;
alter table public.game_states enable row level security;
alter table public.moves enable row level security;

-- games: participants may SELECT; no client INSERT/UPDATE/DELETE.
create policy games_participants_select on public.games
  for select using (auth.uid() = player1 or auth.uid() = player2);

-- game_states: NO policies at all — service-role only.

-- moves: participants may browse the log.
create policy moves_participants_select on public.moves
  for select using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (auth.uid() = g.player1 or auth.uid() = g.player2)
    )
  );

-- Realtime: clients subscribe to UPDATEs on their games row and refetch
-- their view whenever `version` bumps.
alter publication supabase_realtime add table public.games;
