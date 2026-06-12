/**
 * Typed wrapper over the `gwent` edge function — the ONLY way the client
 * touches game data online. The server returns PlayerViews; the full
 * GameState never reaches a device.
 */

import type { DeckList, Move, PlayerId, PlayerView } from '../engine/types';
import { supabase } from './supabase';

export interface OnlineGameSnapshot {
  status: 'waiting' | 'active' | 'finished';
  version: number;
  seat: PlayerId;
  roomCode?: string;
  view?: PlayerView;
}

async function call<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  if (!supabase) {
    throw new Error('Online play is not configured.');
  }
  const { data, error } = await supabase.functions.invoke('gwent', {
    body: { action, ...payload },
  });
  if (error) {
    // Edge functions put their message in the response body on non-2xx.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = (await context.json()) as { error?: string };
        if (body.error) {
          throw new Error(body.error);
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') {
          throw parseError;
        }
      }
    }
    throw new Error(error.message ?? 'Network error.');
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

export function createRoom(deck: DeckList): Promise<{ gameId: string; roomCode: string }> {
  return call('create_game', { deck });
}

export function joinRoom(roomCode: string, deck: DeckList): Promise<{ gameId: string }> {
  return call('join_game', { roomCode, deck });
}

export function fetchSnapshot(gameId: string): Promise<OnlineGameSnapshot> {
  return call('get_view', { gameId });
}

export function submitMove(gameId: string, move: Move): Promise<OnlineGameSnapshot> {
  return call('submit_move', { gameId, move });
}
