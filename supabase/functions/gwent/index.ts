/**
 * GWENT online — the authoritative server, as one Edge Function with action
 * routing (create_game / join_game / get_view / submit_move; the brief's four
 * endpoints, consolidated so the engine ships in a single bundle).
 *
 * The full GameState (seed, hands, decks) only ever exists here and in the
 * service-role-only game_states table. Clients receive PlayerViews. Every
 * move is validated by the same applyMove the app runs locally — an illegal
 * move is a 400, never a state change.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
// Runtime engine: the bundled build of src/engine (npm run sync:engine).
import {
  actorOf,
  applyMove,
  createGame,
  getView,
  GwentError,
  validateDeck,
} from './engine.js';
// Types only (erased at runtime) — kept in sync by the same script.
import type { DeckList, GameState, Move, PlayerId } from './types.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Unambiguous room codes: no 0/O/1/I/L. */
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

interface GameRow {
  id: string;
  room_code: string;
  status: 'waiting' | 'active' | 'finished';
  player1: string;
  player2: string | null;
  current_player: string | null;
  version: number;
  winner: string | null;
}

/** Pre-game lobby payload stored in game_states until player 2 joins. */
interface LobbyState {
  lobby: true;
  decks: { p1: DeckList };
}

function seatOf(game: GameRow, uid: string): PlayerId | null {
  if (uid === game.player1) {
    return 'p1';
  }
  if (game.player2 !== null && uid === game.player2) {
    return 'p2';
  }
  return null;
}

function uidOfSeat(game: GameRow, seat: PlayerId): string | null {
  return seat === 'p1' ? game.player1 : game.player2;
}

async function loadGame(admin: SupabaseClient, gameId: string): Promise<GameRow | null> {
  const { data } = await admin.from('games').select('*').eq('id', gameId).maybeSingle();
  return data as GameRow | null;
}

async function loadState(
  admin: SupabaseClient,
  gameId: string,
): Promise<GameState | LobbyState | null> {
  const { data } = await admin
    .from('game_states')
    .select('state')
    .eq('game_id', gameId)
    .maybeSingle();
  return data ? (data.state as GameState | LobbyState) : null;
}

function isLobby(state: GameState | LobbyState): state is LobbyState {
  return (state as LobbyState).lobby === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  try {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return json({ error: 'Not signed in.' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const body = await req.json();
    switch (body.action) {
      // -----------------------------------------------------------------
      case 'create_game': {
        const deck = body.deck as DeckList;
        validateDeck(deck);

        // One open room per host: creating a new room retires any previous
        // waiting room of yours (cascade removes its lobby state).
        await admin.from('games').delete().eq('player1', user.id).eq('status', 'waiting');

        for (let attempt = 0; attempt < 5; attempt++) {
          const roomCode = makeRoomCode();
          const { data: game, error } = await admin
            .from('games')
            .insert({ room_code: roomCode, player1: user.id })
            .select()
            .single();
          if (error) {
            if (error.code === '23505') {
              continue; // room code collision — roll again
            }
            throw error;
          }
          const lobby: LobbyState = { lobby: true, decks: { p1: deck } };
          await admin.from('game_states').insert({ game_id: game.id, state: lobby });
          return json({ gameId: game.id, roomCode });
        }
        return json({ error: 'Could not allocate a room code. Try again.' }, 500);
      }

      // -----------------------------------------------------------------
      case 'join_game': {
        const deck = body.deck as DeckList;
        const roomCode = String(body.roomCode ?? '').trim().toUpperCase();
        validateDeck(deck);

        const { data } = await admin
          .from('games')
          .select('*')
          .eq('room_code', roomCode)
          .eq('status', 'waiting')
          .maybeSingle();
        const game = data as GameRow | null;
        if (!game) {
          return json({ error: 'No open room with that code.' }, 404);
        }
        if (game.player1 === user.id) {
          return json({ error: 'You cannot join your own room.' }, 400);
        }

        const lobby = await loadState(admin, game.id);
        if (!lobby || !isLobby(lobby)) {
          return json({ error: 'Room is not joinable.' }, 409);
        }

        const state = createGame(
          { players: { p1: { deck: lobby.decks.p1 }, p2: { deck } } },
          crypto.randomUUID(),
        );
        const firstActor = uidOfSeat({ ...game, player2: user.id }, actorOf(state));

        const { data: updated } = await admin
          .from('games')
          .update({
            player2: user.id,
            status: 'active',
            current_player: firstActor,
            version: 1,
          })
          .eq('id', game.id)
          .eq('status', 'waiting') // double-join race guard
          .select()
          .maybeSingle();
        if (!updated) {
          return json({ error: 'Someone else just took that seat.' }, 409);
        }
        await admin.from('game_states').update({ state, updated_at: new Date().toISOString() }).eq('game_id', game.id);
        return json({ gameId: game.id });
      }

      // -----------------------------------------------------------------
      case 'cancel_game': {
        // The host abandons their still-waiting room; it vanishes entirely.
        const gameId = String(body.gameId ?? '');
        await admin
          .from('games')
          .delete()
          .eq('id', gameId)
          .eq('player1', user.id)
          .eq('status', 'waiting');
        return json({ ok: true });
      }

      // -----------------------------------------------------------------
      case 'get_view': {
        const gameId = String(body.gameId ?? '');
        const game = await loadGame(admin, gameId);
        const seat = game ? seatOf(game, user.id) : null;
        if (!game || !seat) {
          return json({ error: 'Game not found.' }, 404);
        }
        const state = await loadState(admin, gameId);
        if (!state || isLobby(state)) {
          return json({ status: 'waiting', roomCode: game.room_code, version: game.version, seat });
        }
        return json({
          status: game.status,
          version: game.version,
          seat,
          roomCode: game.room_code,
          view: getView(state, seat),
        });
      }

      // -----------------------------------------------------------------
      case 'submit_move': {
        const gameId = String(body.gameId ?? '');
        const move = body.move as Move;
        const game = await loadGame(admin, gameId);
        const seat = game ? seatOf(game, user.id) : null;
        if (!game || !seat) {
          return json({ error: 'Game not found.' }, 404);
        }
        if (game.status !== 'active') {
          return json({ error: 'Game is not active.' }, 409);
        }
        const state = await loadState(admin, gameId);
        if (!state || isLobby(state)) {
          return json({ error: 'Game has not started.' }, 409);
        }
        if (move?.player !== seat) {
          return json({ error: 'You can only move for your own seat.' }, 403);
        }

        const next = applyMove(state, move); // GwentError on anything illegal
        const result = next.result;
        const version = game.version + 1;

        // Optimistic concurrency: someone else bumped the version → retry.
        const { data: updated } = await admin
          .from('games')
          .update({
            version,
            current_player: result ? null : uidOfSeat(game, actorOf(next)),
            status: result ? 'finished' : 'active',
            winner: result?.winner ? uidOfSeat(game, result.winner) : null,
          })
          .eq('id', gameId)
          .eq('version', game.version)
          .select()
          .maybeSingle();
        if (!updated) {
          return json({ error: 'Out of sync — refresh and try again.' }, 409);
        }
        await admin
          .from('game_states')
          .update({ state: next, updated_at: new Date().toISOString() })
          .eq('game_id', gameId);
        await admin
          .from('moves')
          .insert({ game_id: gameId, idx: version, player: user.id, move });

        return json({
          status: result ? 'finished' : 'active',
          version,
          seat,
          view: getView(next, seat),
        });
      }

      default:
        return json({ error: `Unknown action: ${String(body.action)}` }, 400);
    }
  } catch (error) {
    if (error instanceof GwentError) {
      return json({ error: error.message }, 400);
    }
    console.error(error);
    return json({ error: 'Internal error.' }, 500);
  }
});
