/**
 * Terminal opponent for online testing:
 *   npx tsx scripts/online-bot.ts <ROOMCODE> [difficulty] [faction]
 *
 * Joins the room as an anonymous user and plays the match with the real M3
 * agent (default: normal, monsters starter). Lets you test online play with
 * a single phone — create a room in the app, feed the code to the bot.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { STARTER_DECKS } from '../src/engine/data/decks.ts';
import type { Move, PlayerView } from '../src/engine/types.ts';
import { chooseMove, type Difficulty } from '../src/ai/agent.ts';

const roomCode = (process.argv[2] ?? '').trim().toUpperCase();
const difficulty = (['easy', 'normal', 'hard'].includes(process.argv[3] ?? '')
  ? process.argv[3]
  : 'normal') as Difficulty;
type F = keyof typeof STARTER_DECKS;
const faction = (Object.keys(STARTER_DECKS).includes(process.argv[4] ?? '')
  ? process.argv[4]
  : 'monsters') as F;

if (roomCode.length < 6) {
  console.error('Usage: npx tsx scripts/online-bot.ts <ROOMCODE> [easy|normal|hard] [faction]');
  process.exit(1);
}

const env: Record<string, string> = {};
for (const line of readFileSync(join(import.meta.dirname ?? '.', '..', '.env'), 'utf8').split(/\r?\n/)) {
  const eq = line.indexOf('=');
  if (eq > 0 && !line.startsWith('#')) {
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
}

const supabase: SupabaseClient = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: true } },
);

async function call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('gwent', { body: { action, ...payload } });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      const body = (await context.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) {
        throw new Error(body.error);
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
  view?: PlayerView;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw error;
  }
  console.log(`Joining room ${roomCode} as ${faction} (${difficulty})…`);
  const { gameId } = await call<{ gameId: string }>('join_game', {
    roomCode,
    deck: STARTER_DECKS[faction],
  });
  console.log('Joined. Playing…');

  let rounds = 0;
  for (;;) {
    const snap = await call<Snapshot>('get_view', { gameId });
    const view = snap.view;
    if (snap.status === 'finished' && view?.result) {
      const mine = view.result.winner === view.player;
      console.log(
        `Match over — ${view.result.winner === null ? 'draw' : mine ? 'bot wins' : 'you win!'}`,
      );
      return;
    }
    if (view && view.roundHistory.length > rounds) {
      rounds = view.roundHistory.length;
      const r = view.roundHistory[rounds - 1];
      console.log(`  round ${r.round}: ${r.totals.p1}:${r.totals.p2}`);
    }
    if (view && view.legalMoves.length > 0) {
      const move: Move = chooseMove(view, difficulty);
      await sleep(800); // human-ish pacing
      try {
        const after = await call<Snapshot>('submit_move', { gameId, move });
        console.log(`  bot move #${after.version} (${move.type})`);
      } catch (submitError) {
        console.log('  resync:', submitError instanceof Error ? submitError.message : submitError);
      }
    } else {
      await sleep(1500); // your turn — bot waits
    }
  }
}

main().catch((error) => {
  console.error('BOT FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
