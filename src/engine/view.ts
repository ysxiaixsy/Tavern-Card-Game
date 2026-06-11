/**
 * getView — projects the full GameState down to what ONE player may know.
 *
 * Hidden: the opponent's hand contents (except cards revealed by Emhyr's
 * peek) and BOTH decks' contents and order — even your own deck is counts
 * only. Public: the board, both graveyards, gems, hand/deck counts, active
 * weather, leaders and whether they were used, round history and result.
 *
 * The AI consumes a PlayerView, never a GameState, so it cannot cheat.
 * `legalMoves` is included for the viewing player (it leaks nothing: every
 * input to move legality is information the player owns or can see; Foltest's
 * fog-in-deck check matches knowing your own deck list, as in the real game).
 */

import { getLegalMoves } from './legal.ts';
import { activeWeatherKinds, opponentOf, ROW_KINDS } from './helpers.ts';
import { rowUnitViews } from './strength.ts';
import type {
  GameState,
  PlayerId,
  PlayerView,
  RowKind,
  RowView,
  SideView,
} from './types.ts';

function buildSideView(state: GameState, side: PlayerId): SideView {
  const ps = state.players[side];
  const rows = {} as Record<RowKind, RowView>;
  let total = 0;
  for (const rowKind of ROW_KINDS) {
    const units = rowUnitViews(state, side, rowKind);
    const rowSum = units.reduce((sum, u) => sum + u.effectiveStrength, 0);
    rows[rowKind] = { units, horn: ps.rows[rowKind].horn, total: rowSum };
    total += rowSum;
  }
  return {
    faction: ps.faction,
    gems: ps.gems,
    passed: ps.passed,
    leader: ps.leader,
    leaderUsed: ps.leaderUsed,
    deckCount: ps.deck.length,
    graveyard: ps.graveyard,
    rows,
    total,
  };
}

export function getView(state: GameState, player: PlayerId): PlayerView {
  const opp = opponentOf(player);
  const you = state.players[player];
  const oppState = state.players[opp];

  // Emhyr's peek: cards revealed to `player` that are still in the opponent's hand.
  const revealedHand = oppState.hand.filter((c) =>
    you.knownOpponentCardIds.includes(c.instanceId),
  );

  return {
    player,
    phase: state.phase,
    round: state.round,
    turn: state.turn,
    pendingChoice: state.pendingChoice,
    you: {
      ...buildSideView(state, player),
      hand: you.hand,
      mulliganDone: you.mulliganDone,
      mulligansUsed: you.mulligansUsed,
    },
    opponent: {
      ...buildSideView(state, opp),
      handCount: oppState.hand.length,
      revealedHand,
    },
    weather: { kinds: activeWeatherKinds(state), cards: state.weatherCards },
    roundHistory: state.roundHistory,
    result: state.result,
    legalMoves: getLegalMoves(state, player),
  };
}
