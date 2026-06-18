/**
 * Test utilities. GameState is plain JSON by contract, so tests may craft
 * states directly — this builder skips createGame's deck validation to set
 * up exact board positions (including ones starter decks can't reach, like
 * Nilfgaard/Scoia'tael sides whose card sets only arrive in M5).
 */

import { getCardDef } from '../data/cards.ts';
import { applyMove } from '../apply.ts';
import { seedToRngState } from '../rng.ts';
import type {
  CardInstance,
  Faction,
  GamePhase,
  GameState,
  PendingChoice,
  PlayerId,
  PlayerState,
  RowKind,
} from '../types.ts';

let instanceCounter = 0;

/** Fabricate a unique CardInstance for a card def. */
export function inst(defId: string): CardInstance {
  getCardDef(defId); // throws early on typos
  instanceCounter += 1;
  return { instanceId: `t${instanceCounter}:${defId}`, defId };
}

export function insts(defIds: readonly string[]): CardInstance[] {
  return defIds.map(inst);
}

export interface SideSpec {
  leader?: string;
  faction?: Faction;
  leaderUsed?: boolean;
  gems?: number;
  passed?: boolean;
  mulliganDone?: boolean;
  hand?: readonly string[];
  deck?: readonly string[];
  graveyard?: readonly string[];
  rows?: Partial<Record<RowKind, readonly string[]>>;
}

const DEFAULT_LEADER: Record<PlayerId, string> = {
  p1: 'nr_foltest',
  p2: 'mon_eredin',
};

function buildSide(p: PlayerId, spec: SideSpec): PlayerState {
  const leaderId = spec.leader ?? DEFAULT_LEADER[p];
  const leaderDef = getCardDef(leaderId);
  return {
    faction: spec.faction ?? leaderDef.faction,
    leader: { instanceId: `${p}:leader`, defId: leaderId },
    leaderUsed: spec.leaderUsed ?? false,
    gems: spec.gems ?? 2,
    hand: insts(spec.hand ?? []),
    deck: insts(spec.deck ?? []),
    graveyard: insts(spec.graveyard ?? []),
    rows: {
      melee: { units: insts(spec.rows?.melee ?? []), horn: null },
      ranged: { units: insts(spec.rows?.ranged ?? []), horn: null },
      siege: { units: insts(spec.rows?.siege ?? []), horn: null },
    },
    passed: spec.passed ?? false,
    mulliganDone: spec.mulliganDone ?? true,
    mulligansUsed: 0,
    knownOpponentCardIds: [],
  };
}

export interface StateSpec {
  p1?: SideSpec;
  p2?: SideSpec;
  phase?: GamePhase;
  round?: number;
  turn?: PlayerId;
  roundLeader?: PlayerId;
  pendingChoice?: PendingChoice | null;
  weather?: { defId: string; owner: PlayerId }[];
  seed?: string;
}

/** Craft a mid-game state directly (default: round 1 of play, p1 to act). */
export function makeState(spec: StateSpec = {}): GameState {
  const turn = spec.turn ?? 'p1';
  const p1 = buildSide('p1', spec.p1 ?? {});
  const p2 = buildSide('p2', spec.p2 ?? {});
  return {
    v: 1,
    seed: spec.seed ?? 'testkit',
    rngState: seedToRngState(spec.seed ?? 'testkit'),
    config: {
      players: {
        p1: { deck: { leaderId: p1.leader.defId, cardIds: [] } },
        p2: { deck: { leaderId: p2.leader.defId, cardIds: [] } },
      },
    },
    phase: spec.phase ?? 'play',
    round: spec.round ?? 1,
    turn,
    roundLeader: spec.roundLeader ?? turn,
    players: { p1, p2 },
    weatherCards: (spec.weather ?? []).map(({ defId, owner }) => ({ ...inst(defId), owner })),
    pendingSummons: [],
    pendingChoice: spec.pendingChoice ?? null,
    roundHistory: [],
    result: null,
    moveCount: 0,
  };
}

/** First card in hand with this def id (throws if absent). */
export function handCard(state: GameState, player: PlayerId, defId: string): CardInstance {
  const card = state.players[player].hand.find((c) => c.defId === defId);
  if (!card) {
    throw new Error(`testkit: ${player} has no ${defId} in hand`);
  }
  return card;
}

/** Play a hand card by def id. */
export function play(
  state: GameState,
  player: PlayerId,
  defId: string,
  extra: { row?: RowKind; targetInstanceId?: string } = {},
): GameState {
  return applyMove(state, {
    type: 'PLAY_CARD',
    player,
    cardInstanceId: handCard(state, player, defId).instanceId,
    ...extra,
  });
}

export function pass(state: GameState, player: PlayerId): GameState {
  return applyMove(state, { type: 'PASS', player });
}

/** All instanceIds currently on a player's side of the board. */
export function boardIds(state: GameState, player: PlayerId): string[] {
  const ids: string[] = [];
  for (const rowKind of ['melee', 'ranged', 'siege'] as const) {
    for (const unit of state.players[player].rows[rowKind].units) {
      ids.push(unit.instanceId);
    }
  }
  return ids;
}

/** Def ids in a player's graveyard (sorted, for stable assertions). */
export function graveyardDefs(state: GameState, player: PlayerId): string[] {
  return state.players[player].graveyard.map((c) => c.defId).sort();
}
