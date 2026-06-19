/**
 * Legal move enumeration. getLegalMoves(state, player) returns every move
 * `player` may submit right now — [] when it is not their turn to act.
 * applyMove performs its own validation; these two must stay in agreement
 * (the determinism test plays thousands of moves sampled from here).
 */

import { getCardDef } from './data/cards.ts';
import {
  decoyTargets,
  medicTargets,
  opponentOf,
  ROW_KINDS,
  weatherIndexInDeck,
} from './helpers.ts';
import { rowTotal } from './strength.ts';
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
    case 'mardroeme':
      // Legal even with no Berserkers out (it simply fizzles, like Scorch).
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
  const def = getCardDef(ps.leader.defId);
  switch (def.leaderAbility) {
    case 'weather_from_deck':
      return def.leaderWeather && weatherIndexInDeck(ps, def.leaderWeather) !== -1
        ? [{ type: 'USE_LEADER', player }]
        : [];
    case 'clear_weather':
      // Only offered while weather is actually on the board (no wasted uses).
      return state.weatherCards.length === 0 ? [] : [{ type: 'USE_LEADER', player }];
    case 'scorch_row_leader': {
      const row = def.leaderScorchRow;
      if (!row) {
        return [];
      }
      const opp = opponentOf(player);
      const hasVictim = state.players[opp].rows[row].units.some(
        (u) => getCardDef(u.defId).type === 'unit',
      );
      return rowTotal(state, opp, row) >= 10 && hasVictim
        ? [{ type: 'USE_LEADER', player }]
        : [];
    }
    case 'row_horn': {
      const row = def.leaderHornRow;
      return row && ps.rows[row].horn === null ? [{ type: 'USE_LEADER', player }] : [];
    }
    case 'cancel_leader':
      return state.players[opponentOf(player)].leaderUsed
        ? []
        : [{ type: 'USE_LEADER', player }];
    case 'peek_hand':
      return state.players[opponentOf(player)].hand.length === 0
        ? []
        : [{ type: 'USE_LEADER', player }];
    case 'restore_to_hand':
      return medicTargets(ps).map((target) => ({
        type: 'USE_LEADER',
        player,
        targetInstanceId: target.instanceId,
      }));
    case 'play_from_graveyard': {
      const moves: Move[] = [];
      for (const target of medicTargets(ps)) {
        if (getCardDef(target.defId).row === 'agile') {
          for (const row of AGILE_ROWS) {
            moves.push({ type: 'USE_LEADER', player, targetInstanceId: target.instanceId, row });
          }
        } else {
          moves.push({ type: 'USE_LEADER', player, targetInstanceId: target.instanceId });
        }
      }
      return moves;
    }
    case 'steal_from_graveyard':
      return medicTargets(state.players[opponentOf(player)]).map((target) => ({
        type: 'USE_LEADER',
        player,
        targetInstanceId: target.instanceId,
      }));
    case 'discard_draw': {
      // Every (pair of hand cards) × (distinct deck card): the move payload
      // is complete, per the engine's no-mid-move-prompt rule.
      if (ps.hand.length < 2 || ps.deck.length === 0) {
        return [];
      }
      const deckDefIds = [...new Set(ps.deck.map((c) => c.defId))].sort();
      const moves: Move[] = [];
      for (let i = 0; i < ps.hand.length; i++) {
        for (let j = i + 1; j < ps.hand.length; j++) {
          for (const drawDefId of deckDefIds) {
            moves.push({
              type: 'USE_LEADER',
              player,
              discardInstanceIds: [ps.hand[i].instanceId, ps.hand[j].instanceId],
              drawDefId,
            });
          }
        }
      }
      return moves;
    }
    case 'reshuffle_graveyards':
      // Crach an Craite: only worth offering when there's something to recycle.
      return state.players.p1.graveyard.length + state.players.p2.graveyard.length > 0
        ? [{ type: 'USE_LEADER', player }]
        : [];
    case 'halve_weather':
      // King Bran: only offered while weather is on the board (it does nothing
      // otherwise, and persists once tapped — see strength.ts).
      return state.weatherCards.length === 0 ? [] : [{ type: 'USE_LEADER', player }];
    case 'draw_extra_start':
      // Auto-triggered at match start; never an on-demand move.
      return [];
    default:
      return [];
  }
}
