/**
 * End-to-end smoke test against the REAL Supabase backend:
 *   npm run smoke:online
 *
 * Two anonymous users create/join a room and play a complete random game
 * through the edge function only. Verifies: anonymous auth, room codes,
 * RLS (game_states unreadable, games participant-only), seat enforcement,
 * server-side rule validation, and that views drive a full match to a result.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { MONSTERS_STARTER, NORTHERN_REALMS_STARTER } from '../src/engine/data/decks.ts';
import { rngInt, seedToRngState } from '../src/engine/rng.ts';
import type { Move, PlayerId } from '../src/engine/types.ts';

// Minimal .env loader (no dotenv dependency).
const env: Record<string, string> = {};
for (const line of readFileSync(join(import.meta.dirname ?? '.', '..', '.env'), 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0 && !line.startsWith('#')) {
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}
const URL = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_* in .env');
  process.exit(1);
}

function newClient(): SupabaseClient {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function call<T = Record<string, unknown>>(
  client: SupabaseClient,
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.functions.invoke('gwent', { body: { action, ...payload } });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = (await context.json()) as { error?: string };
        if (body.error) {
          throw new Error(body.error);
        }
      } catch (e) {
        if (e instanceof Error && !e.message.includes('JSON')) {
          throw e;
        }
      }
    }
    throw new Error(error.message);
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

interface Snapshot {
  status: string;
  version: number;
  seat: PlayerId;
  view?: {
    legalMoves: Move[];
    roundHistory: { round: number; totals: Record<PlayerId, number> }[];
    result: { winner: PlayerId | null } | null;
    you: { hand: unknown[] };
  };
}

async function main(): Promise<void> {
  console.log('— signing in two anonymous users…');
  const a = newClient();
  const b = newClient();
  const ra = await a.auth.signInAnonymously();
  if (ra.error) {
    console.error('\n✗ Anonymous sign-in failed:', ra.error.message);
    console.error('  → Supabase Dashboard → Authentication → Sign In / Up →');
    console.error('    enable "Allow anonymous sign-ins", then rerun.');
    process.exit(1);
  }
  const rb = await b.auth.signInAnonymously();
  if (rb.error) {
    throw rb.error;
  }
  console.log('  p1 uid:', ra.data.user?.id);
  console.log('  p2 uid:', rb.data.user?.id);

  console.log('— creating room (NR starter)…');
  const { gameId, roomCode } = await call<{ gameId: string; roomCode: string }>(a, 'create_game', {
    deck: NORTHERN_REALMS_STARTER,
  });
  console.log('  room:', roomCode, 'game:', gameId);

  console.log('— RLS probes…');
  const { data: gsRows } = await a.from('game_states').select('game_id');
  if (gsRows && gsRows.length > 0) {
    throw new Error('RLS FAILURE: client can read game_states!');
  }
  const { data: stranger } = await b.from('games').select('id').eq('id', gameId);
  if (stranger && stranger.length > 0) {
    throw new Error('RLS FAILURE: non-participant can see the game row!');
  }
  console.log('  ✓ game_states unreadable; games hidden from strangers');

  console.log('— joining (Monsters starter)…');
  await call(b, 'join_game', { roomCode, deck: MONSTERS_STARTER });
  const { data: ownRow } = await a.from('games').select('status').eq('id', gameId).single();
  if (ownRow?.status !== 'active') {
    throw new Error(`expected active game, got ${String(ownRow?.status)}`);
  }
  console.log('  ✓ game active; participant can read their games row');

  console.log('— cheat probe: p1 submitting a move as p2…');
  try {
    await call(a, 'submit_move', { gameId, move: { type: 'PASS', player: 'p2' } });
    throw new Error('CHEAT ACCEPTED: seat enforcement failed!');
  } catch (error) {
    if (error instanceof Error && /own seat/i.test(error.message)) {
      console.log('  ✓ rejected:', error.message);
    } else {
      throw error;
    }
  }

  console.log('— playing a full random game through the server…');
  const clients: Record<PlayerId, SupabaseClient> = { p1: a, p2: b };
  let rng = seedToRngState('online-smoke');
  let moveCount = 0;
  let rounds = 0;
  for (let guard = 0; guard < 300; guard++) {
    const sa = await call<Snapshot>(a, 'get_view', { gameId });
    if (sa.status === 'finished') {
      const winner = sa.view?.result?.winner ?? null;
      console.log(`  ✓ finished after ${moveCount} server-validated moves — winner: ${winner ?? 'draw'}`);
      console.log('SMOKE PASSED');
      return;
    }
    const actorSeat: PlayerId = (sa.view?.legalMoves.length ?? 0) > 0 ? 'p1' : 'p2';
    const snap =
      actorSeat === 'p1' ? sa : await call<Snapshot>(b, 'get_view', { gameId });
    const legal = snap.view?.legalMoves ?? [];
    if (legal.length === 0) {
      throw new Error('no legal moves for either seat but game not finished');
    }
    const [index, next] = rngInt(rng, legal.length);
    rng = next;
    const res = await call<Snapshot>(clients[actorSeat], 'submit_move', {
      gameId,
      move: legal[index],
    });
    moveCount++;
    const seen = res.view?.roundHistory.length ?? 0;
    if (seen > rounds) {
      rounds = seen;
      const r = res.view!.roundHistory[seen - 1];
      console.log(`    round ${r.round}: ${r.totals.p1}:${r.totals.p2} (${moveCount} moves so far)`);
    }
    if (res.status === 'finished') {
      console.log(`  ✓ finished after ${moveCount} server-validated moves — winner: ${res.view?.result?.winner ?? 'draw'}`);
      console.log('SMOKE PASSED');
      return;
    }
  }
  throw new Error('game did not finish within 300 moves');
}

main().catch((error) => {
  console.error('\nSMOKE FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
