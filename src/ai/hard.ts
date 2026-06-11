/**
 * Hard difficulty: Normal's shortlist, re-ranked by determinized rollouts.
 *
 * The agent still only KNOWS the PlayerView. To look ahead it builds
 * "determinizations": synthetic GameStates where every hidden zone (both
 * decks, the opponent's unrevealed hand) is filled with plausible cards
 * sampled from the faction's card pool. Each candidate move is applied to a
 * few determinizations and the round is played out with the Normal policy on
 * both sides; the candidate with the best average outcome wins.
 *
 * Deterministic: the sampler is seeded from the view, so the same view
 * always yields the same move. Budget: ≤4 candidates × 2 determinizations,
 * rollouts capped at 40 plies — comfortably under a second on a phone.
 */

import { applyMove } from '../engine/apply.ts';
import { CARD_DEFS, getCardDef } from '../engine/data/cards.ts';
import { getView } from '../engine/view.ts';
import { rngInt, seedToRngState } from '../engine/rng.ts';
import type {
  CardInstance,
  Faction,
  GameState,
  Move,
  PlayerId,
  PlayerState,
  PlayerView,
  RowKind,
  SideView,
} from '../engine/types.ts';
import { scoreMoves } from './normal.ts';

const CANDIDATES = 4;
const DETERMINIZATIONS = 2;
const ROLLOUT_CAP = 40;

export function chooseHardMove(view: PlayerView): Move {
  const ranked = scoreMoves(view);
  // Forced situations and overwhelming plays don't need a crystal ball.
  if (view.pendingChoice !== null || view.phase !== 'play' || ranked[0].score >= 500) {
    return ranked[0].move;
  }
  const candidates = ranked.slice(0, CANDIDATES);
  if (candidates.length === 1) {
    return candidates[0].move;
  }

  let rng = seedToRngState(
    `hard|${view.player}|${view.round}|${view.you.total}:${view.opponent.total}|` +
      view.you.hand.map((c) => c.instanceId).join(','),
  );

  let bestMove = candidates[0].move;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    let total = 0;
    for (let d = 0; d < DETERMINIZATIONS; d++) {
      const [state, nextRng] = determinize(view, rng);
      rng = nextRng;
      total += rolloutScore(state, candidate.move, view.player);
    }
    const avg = total / DETERMINIZATIONS;
    if (avg > bestScore) {
      bestScore = avg;
      bestMove = candidate.move;
    }
  }
  return bestMove;
}

// ---------------------------------------------------------------------------
// Determinization
// ---------------------------------------------------------------------------

let simCounter = 0;

/** Plausible hidden cards for a side: its faction pool plus neutrals. */
function samplePool(faction: Faction): string[] {
  return CARD_DEFS.filter(
    (def) => def.type !== 'leader' && (def.faction === faction || def.faction === 'neutral'),
  ).map((def) => def.id);
}

function sampleCards(pool: string[], count: number, rng: number): [CardInstance[], number] {
  const cards: CardInstance[] = [];
  let state = rng;
  for (let i = 0; i < count; i++) {
    const [index, next] = rngInt(state, pool.length);
    state = next;
    simCounter += 1;
    cards.push({ instanceId: `sim:${simCounter}`, defId: pool[index] });
  }
  return [cards, state];
}

function toPlayerState(
  side: SideView,
  hand: CardInstance[],
  deck: CardInstance[],
): PlayerState {
  const rows = {} as PlayerState['rows'];
  for (const rowKind of ['melee', 'ranged', 'siege'] as RowKind[]) {
    rows[rowKind] = {
      units: side.rows[rowKind].units.map((u) => ({ instanceId: u.instanceId, defId: u.defId })),
      horn: side.rows[rowKind].horn,
    };
  }
  return {
    faction: side.faction,
    leader: side.leader,
    leaderUsed: side.leaderUsed,
    gems: side.gems,
    hand,
    deck,
    graveyard: side.graveyard.slice(),
    rows,
    passed: side.passed,
    mulliganDone: true,
    mulligansUsed: 0,
    knownOpponentCardIds: [],
  };
}

function determinize(view: PlayerView, rng: number): [GameState, number] {
  const me = view.player;
  const opp: PlayerId = me === 'p1' ? 'p2' : 'p1';

  // My hidden deck: sampled — but stay consistent with observed legality
  // (a usable weather_from_deck leader implies its weather really is in there).
  const myPool = samplePool(view.you.faction);
  let [myDeck, rng1] = sampleCards(myPool, view.you.deckCount, rng);
  const myLeader = getCardDef(view.you.leader.defId);
  const leaderUsable = view.legalMoves.some((m) => m.type === 'USE_LEADER');
  if (
    leaderUsable &&
    myLeader.leaderAbility === 'weather_from_deck' &&
    myLeader.leaderWeather &&
    myDeck.length > 0 &&
    !myDeck.some((c) => getCardDef(c.defId).weather === myLeader.leaderWeather)
  ) {
    const weatherDefId = { frost: 'neu_frost', fog: 'neu_fog', rain: 'neu_rain' }[
      myLeader.leaderWeather
    ];
    myDeck = [
      ...myDeck.slice(0, -1),
      { instanceId: `sim:weather-${++simCounter}`, defId: weatherDefId },
    ];
  }

  // Opponent hand: Emhyr-revealed cards are known; the rest is sampled.
  const oppPool = samplePool(view.opponent.faction);
  const hiddenCount = Math.max(0, view.opponent.handCount - view.opponent.revealedHand.length);
  const [oppHidden, rng2] = sampleCards(oppPool, hiddenCount, rng1);
  const [oppDeck, rng3] = sampleCards(oppPool, view.opponent.deckCount, rng2);

  const players = {
    [me]: toPlayerState(view.you, view.you.hand.slice(), myDeck),
    [opp]: toPlayerState(view.opponent, [...view.opponent.revealedHand, ...oppHidden], oppDeck),
  } as Record<PlayerId, PlayerState>;

  const state: GameState = {
    v: 1,
    seed: 'sim',
    rngState: rng3,
    config: {
      players: {
        p1: { deck: { leaderId: players.p1.leader.defId, cardIds: [] } },
        p2: { deck: { leaderId: players.p2.leader.defId, cardIds: [] } },
      },
    },
    phase: 'play',
    round: view.round,
    turn: me,
    roundLeader: me, // approximation; only affects post-tie leads inside the rollout
    players,
    weatherCards: view.weather.cards.map((w) => ({ ...w })),
    pendingChoice: null,
    roundHistory: view.roundHistory.slice(),
    result: null,
    moveCount: 0,
  };
  return [state, rng3];
}

// ---------------------------------------------------------------------------
// Rollout
// ---------------------------------------------------------------------------

function rolloutScore(start: GameState, candidate: Move, me: PlayerId): number {
  const opp: PlayerId = me === 'p1' ? 'p2' : 'p1';
  const roundsBefore = start.roundHistory.length;
  let state: GameState;
  try {
    state = applyMove(start, candidate);
  } catch {
    return -Infinity; // the sampled world made this move illegal — punish it
  }

  let guard = 0;
  while (state.result === null && state.roundHistory.length === roundsBefore && guard < ROLLOUT_CAP) {
    guard += 1;
    const actor = state.pendingChoice?.player ?? state.turn;
    const actorView = getView(state, actor);
    if (actorView.legalMoves.length === 0) {
      break; // defensive; the engine force-passes empty hands itself
    }
    state = applyMove(state, scoreMoves(actorView)[0].move);
  }

  const mine = state.players[me];
  const theirs = state.players[opp];
  let score = (mine.gems - theirs.gems) * 120 + (mine.hand.length - theirs.hand.length) * 12;
  if (state.result !== null) {
    score += state.result.winner === me ? 400 : state.result.winner === null ? 0 : -400;
  }
  return score;
}
