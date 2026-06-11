/**
 * Legal move enumeration. getLegalMoves(state, player) returns every move
 * `player` may submit right now — [] when it is not their turn to act.
 * applyMove performs its own validation; these two must stay in agreement
 * (the determinism test plays thousands of moves sampled from here).
 */

import { getCardDef } from './data/cards.ts';
import {
  decoyTargets,
  fogIndexInDeck,
  medicTargets,
  opponentOf,
  ROW_KINDS,
} from './helpers.ts';
import type {
  CardInstance,
  GameState,
  Move,
  MulliganMove,
  PlayerId,
  RowKind,
} from './types.ts';

const AGILE_ROWS: readonly RowKind[] = ['melee', 'ranged'];

export function getLegalMoves(state: GameState, player: PlayerId): Move[] {
  if (state.phase === 'finished') {
    return [];
  }

  if (state.pendingChoice) {
    if (state.pendingChoice.player !== player) {
      return [];
    }
    if (state.pendingChoice.kind === 'choose_first_player') {
      return [
        { type: 'CHOOSE_FIRST_PLAYER', player, first: 'p1' },
        { type: 'CHOOSE_FIRST_PLAYER', player, first: 'p2' },
      ];
    }
    // medic_revive: one move per graveyard target (× row choice for agile).
    const moves: Move[] = [];
    for (const target of medicTargets(state.players[player])) {
      if (getCardDef(target.defId).row === 'agile') {
        for (const row of AGILE_ROWS) {
          moves.push({ type: 'RESOLVE_MEDIC', player, targetInstanceId: target.instanceId, row });
        }
      } else {
        moves.push({ type: 'RESOLVE_MEDIC', player, targetInstanceId: target.instanceId });
      }
    }
    return moves;
  }

  if (state.phase === 'mulligan') {
    return state.players[player].mulliganDone ? [] : mulliganMoves(state, player);
  }

  // phase === 'play'
  if (state.turn !== player || state.players[player].passed) {
    return [];
  }

  const moves: Move[] = [{ type: 'PASS', player }];
  for (const card of state.players[player].hand) {
    moves.push(...playCardMoves(state, player, card));
  }
  moves.push(...leaderMoves(state, player));
  return moves;
}

/** Every distinct MULLIGAN submission: keep all, or swap 1, or swap 2. */
function mulliganMoves(state: GameState, player: PlayerId): MulliganMove[] {
  const hand = state.players[player].hand;
  const moves: MulliganMove[] = [{ type: 'MULLIGAN', player, cardInstanceIds: [] }];
  for (let i = 0; i < hand.length; i++) {
    moves.push({ type: 'MULLIGAN', player, cardInstanceIds: [hand[i].instanceId] });
    for (let j = i + 1; j < hand.length; j++) {
      moves.push({
        type: 'MULLIGAN',
        player,
        cardInstanceIds: [hand[i].instanceId, hand[j].instanceId],
      });
    }
  }
  return moves;
}

function playCardMoves(state: GameState, player: PlayerId, card: CardInstance): Move[] {
  const def = getCardDef(card.defId);
  const base = { type: 'PLAY_CARD' as const, player, cardInstanceId: card.instanceId };

  switch (def.type) {
    case 'unit':
    case 'hero': {
      if (def.row === 'agile') {
        return AGILE_ROWS.map((row) => ({ ...base, row }));
      }
      return [base];
    }
    case 'weather':
      // Duplicates of active weather are legal (and wasted), as in W3.
      return [base];
    case 'scorch':
      // Legal even with no non-hero units on the board (it simply fizzles).
      return [base];
    case 'horn': {
      const moves: Move[] = [];
      for (const row of ROW_KINDS) {
        if (state.players[player].rows[row].horn === null) {
          moves.push({ ...base, row });
        }
      }
      return moves;
    }
    case 'decoy':
      return decoyTargets(state, player).map((target) => ({
        ...base,
        targetInstanceId: target.instanceId,
      }));
    default:
      return []; // leaders never sit in a hand
  }
}

function leaderMoves(state: GameState, player: PlayerId): Move[] {
  const ps = state.players[player];
  if (ps.leaderUsed) {
    return [];
  }
  switch (getCardDef(ps.leader.defId).leaderAbility) {
    case 'foltest_fog':
      return fogIndexInDeck(ps) === -1 ? [] : [{ type: 'USE_LEADER', player }];
    case 'emhyr_peek':
      return state.players[opponentOf(player)].hand.length === 0
        ? []
        : [{ type: 'USE_LEADER', player }];
    case 'eredin_restore':
      return medicTargets(ps).map((target) => ({
        type: 'USE_LEADER',
        player,
        targetInstanceId: target.instanceId,
      }));
    case 'francesca_draw':
      // Auto-triggered at match start; never an on-demand move.
      return [];
    default:
      return [];
  }
}
