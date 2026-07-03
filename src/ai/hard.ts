/**
 * Hard & Witcher difficulties: Normal's shortlist, re-ranked by determinized
 * rollouts.
 *
 * The agent still only KNOWS the PlayerView. To look ahead it builds
 * "determinizations": synthetic GameStates where every hidden zone (both
 * decks, the opponent's unrevealed hand) is filled with plausible cards
 * sampled from the faction's remaining pool (copy limits minus every card
 * already visible on that side). Each candidate move is applied to a few
 * determinizations and played out with the Normal policy on both sides; the
 * candidate with the best average outcome wins. PASS is always a candidate —
 * the rollout, not the shortlist, judges concessions.
 *
 * Deterministic: the sampler is seeded from the view, so the same view
 * always yields the same move.
 *
 *   hard    — 4 candidates × 2 worlds, round-scoped, 40-ply cap.
 *   witcher — 6 candidates × 12 worlds: the deeper averaging over shared
 *             worlds is what separates it (arena: ~67-75% vs hard, ~70% vs
 *             normal). Still comfortably bounded on a phone.
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
import { cardWorth, scoreMoves } from './normal.ts';

interface SearchBudget {
  candidates: number;
  determinizations: number;
  plyCap: number;
  /** Rollouts may cross into the next round (values inter-round economy). */
  crossRound: boolean;
  /** Skip the simulation when normal's top score is at least this (forced /
   * overwhelming plays). */
  obviousAt: number;
}

const HARD: SearchBudget = { candidates: 4, determinizations: 2, plyCap: 40, crossRound: false, obviousAt: 500 };
const WITCHER: SearchBudget = { candidates: 6, determinizations: 12, plyCap: 40, crossRound: false, obviousAt: 500 };

export function chooseHardMove(view: PlayerView): Move {
  return chooseSimulatedMove(view, HARD);
}

export function chooseWitcherMove(view: PlayerView): Move {
  return chooseSimulatedMove(view, WITCHER);
}

function chooseSimulatedMove(view: PlayerView, budget: SearchBudget): Move {
  const ranked = scoreMoves(view);
  // Forced situations and overwhelming plays don't need a crystal ball.
  if (view.pendingChoice !== null || view.phase !== 'play' || ranked[0].score >= budget.obviousAt) {
    return ranked[0].move;
  }
  const candidates = ranked.slice(0, budget.candidates);
  // PASS is always worth simulating: the heuristic underrates concessions,
  // and only the rollout can see what passing saves for later rounds.
  const pass = ranked.find((r) => r.move.type === 'PASS');
  if (pass && !candidates.some((c) => c.move.type === 'PASS')) {
    candidates.push(pass);
  }
  if (candidates.length === 1) {
    return candidates[0].move;
  }

  let rng = seedToRngState(
    `hard|${view.player}|${view.round}|${view.you.total}:${view.opponent.total}|` +
      view.you.hand.map((c) => c.instanceId).join(','),
  );

  // Paired comparison: build the sampled worlds ONCE and score every candidate
  // on the SAME worlds. Otherwise each candidate is judged on different luck
  // and the sampling noise, not the move, decides. applyMove clones, so the
  // worlds can be reused safely.
  const worlds: GameState[] = [];
  for (let d = 0; d < budget.determinizations; d++) {
    const [state, nextRng] = determinize(view, rng);
    rng = nextRng;
    worlds.push(state);
  }

  let bestMove = candidates[0].move;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    let total = 0;
    for (const world of worlds) {
      total += rolloutScore(world, candidate.move, view.player, budget);
    }
    const avg = total / worlds.length;
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

/** defId → number of copies of it already visible in this side's zones. */
function countCopies(cards: Iterable<CardInstance>, into: Map<string, number>): void {
  for (const c of cards) {
    into.set(c.defId, (into.get(c.defId) ?? 0) + 1);
  }
}

/** Every card of one side we can SEE: rows (+horns), graveyard, weather it
 * owns, plus any known hand cards (own hand / Emhyr-revealed). */
function sideVisible(view: PlayerView, side: SideView, owner: PlayerId, known: CardInstance[]): Map<string, number> {
  const seen = new Map<string, number>();
  for (const rowKind of ['melee', 'ranged', 'siege'] as RowKind[]) {
    const row = side.rows[rowKind];
    countCopies(row.units, seen);
    if (row.horn) {
      countCopies([row.horn], seen);
    }
  }
  countCopies(side.graveyard, seen);
  countCopies(view.weather.cards.filter((w) => w.owner === owner), seen);
  countCopies(known, seen);
  return seen;
}

/** Plausible hidden cards for a side, as a MULTISET: per def, its copy limit
 * minus the copies already visible on that side — so a sampled deck can never
 * hold a fourth Arachas or a second Geralt. */
function samplePool(faction: Faction, seen: Map<string, number>): string[] {
  const pool: string[] = [];
  for (const def of CARD_DEFS) {
    if (
      def.type === 'leader' ||
      (def.maxCopiesPerDeck ?? 1) === 0 || // summon/transform-only (Hemdall, Vildkaarls…)
      (def.faction !== faction && def.faction !== 'neutral')
    ) {
      continue;
    }
    const remaining = (def.maxCopiesPerDeck ?? 1) - (seen.get(def.id) ?? 0);
    for (let i = 0; i < remaining; i++) {
      pool.push(def.id);
    }
  }
  return pool;
}

/** Sample without replacement (mutates a copy of the pool). */
function sampleCards(pool: string[], count: number, rng: number): [CardInstance[], string[], number] {
  const remaining = pool.slice();
  const cards: CardInstance[] = [];
  let state = rng;
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const [index, next] = rngInt(state, remaining.length);
    state = next;
    simCounter += 1;
    cards.push({ instanceId: `sim:${simCounter}`, defId: remaining[index] });
    remaining.splice(index, 1);
  }
  return [cards, remaining, state];
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
  const myPool = samplePool(view.you.faction, sideVisible(view, view.you, me, view.you.hand));
  let [myDeck, , rng1] = sampleCards(myPool, view.you.deckCount, rng);
  const myLeader = getCardDef(view.you.leader.defId);
  const leaderUsable = view.legalMoves.some((m) => m.type === 'USE_LEADER');
  if (
    leaderUsable &&
    myLeader.leaderAbility === 'weather_from_deck' &&
    myLeader.leaderWeather &&
    myDeck.length > 0 &&
    !myDeck.some((c) => getCardDef(c.defId).weather === myLeader.leaderWeather)
  ) {
    const weatherDefId = { frost: 'neu_frost', fog: 'neu_fog', rain: 'neu_rain', storm: 'sk_storm' }[
      myLeader.leaderWeather
    ];
    myDeck = [
      ...myDeck.slice(0, -1),
      { instanceId: `sim:weather-${++simCounter}`, defId: weatherDefId },
    ];
  }
  // Likewise for discard_draw (and Eredin King's any-weather): every drawDefId
  // the engine offers really is in the deck, so plant them to keep moves legal.
  if (
    leaderUsable &&
    (myLeader.leaderAbility === 'discard_draw' ||
      (myLeader.leaderAbility === 'weather_from_deck' && !myLeader.leaderWeather))
  ) {
    const wanted = [
      ...new Set(
        view.legalMoves
          .filter((m) => m.type === 'USE_LEADER' && m.drawDefId !== undefined)
          .map((m) => (m as { drawDefId: string }).drawDefId),
      ),
    ];
    for (let i = 0; i < wanted.length && i < myDeck.length; i++) {
      if (!myDeck.some((c) => c.defId === wanted[i])) {
        myDeck[i] = { instanceId: `sim:fetch-${++simCounter}`, defId: wanted[i] };
      }
    }
  }

  // Opponent hand: Emhyr-revealed cards are known; the rest is sampled from
  // one shared pool (hand first, deck from the remainder — no duplicates
  // beyond the copy limits across their hidden zones).
  const oppPool = samplePool(
    view.opponent.faction,
    sideVisible(view, view.opponent, opp, view.opponent.revealedHand),
  );
  const hiddenCount = Math.max(0, view.opponent.handCount - view.opponent.revealedHand.length);
  const [oppHidden, oppRest, rng2] = sampleCards(oppPool, hiddenCount, rng1);
  const [oppDeck, , rng3] = sampleCards(oppRest, view.opponent.deckCount, rng2);

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
    pendingSummons: [],
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

function rolloutScore(start: GameState, candidate: Move, me: PlayerId, budget: SearchBudget): number {
  const opp: PlayerId = me === 'p1' ? 'p2' : 'p1';
  const roundsBefore = start.roundHistory.length;
  let state: GameState;
  try {
    state = applyMove(start, candidate);
  } catch {
    return -Infinity; // the sampled world made this move illegal — punish it
  }

  let guard = 0;
  while (
    state.result === null &&
    (budget.crossRound || state.roundHistory.length === roundsBefore) &&
    guard < budget.plyCap
  ) {
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
  // Gems dominate; card COUNT is the economy backbone; card WORTH shapes it
  // (holding a spy or hero beats holding two mules); match result caps it.
  const myHandWorth = mine.hand.reduce((sum, c) => sum + cardWorth(getCardDef(c.defId)), 0);
  let score =
    (mine.gems - theirs.gems) * 120 +
    (mine.hand.length - theirs.hand.length) * 12 +
    myHandWorth * 0.4;
  if (state.result !== null) {
    score += state.result.winner === me ? 400 : state.result.winner === null ? 0 : -400;
  }
  return score;
}
