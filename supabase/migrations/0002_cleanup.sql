-- Game expiry (per the brief: abandoned games expire by age). The edge
-- function enforces one open room per host; this hourly job mops up the rest.
-- ON DELETE CASCADE on game_states/moves keeps the cleanup to one statement.

create extension if not exists pg_cron;

create index if not exists games_status_created_idx
  on public.games (status, created_at);

select cron.schedule(
  'gwent_cleanup_hourly',
  '17 * * * *',
  $$
  delete from public.games g
  where (g.status = 'waiting'  and g.created_at < now() - interval '2 hours')
     or (g.status = 'finished' and g.created_at < now() - interval '7 days')
     or (g.status = 'active' and exists (
           select 1 from public.game_states s
           where s.game_id = g.id
             and s.updated_at < now() - interval '48 hours'))
  $$
);
