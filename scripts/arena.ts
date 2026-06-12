/**
 * AI arena: `npx tsx scripts/arena.ts [games] [diffA] [diffB] [factionA] [factionB]`
 * Plays N seeded games with sides alternating each game and reports the
 * win rate of diffA. Used for tuning — the vitest arena test is only a
 * 10-game smoke check.
 */

import {
  applyMove,
  createGame,
  getView,
  STARTER_DECKS,
  type GameState,
  type PlayerId,
} from '../src/engine/index.ts';
import { chooseMove, type Difficulty } from '../src/ai/agent.ts';

const games = Number(process.argv[2] ?? 30);
const diffA = (process.argv[3] ?? 'normal') as Difficulty;
const diffB = (process.argv[4] ?? 'easy') as Difficulty;
type F = keyof typeof STARTER_DECKS;
const factionA = (process.argv[5] ?? 'northern_realms') as F;
const factionB = (process.argv[6] ?? 'monsters') as F;

function actorOf(state: GameState): PlayerId {
  if (state.pendingChoice) {
    return state.pendingChoice.player;
  }
  if (state.phase === 'mulligan') {
    return state.players.p1.mulliganDone ? 'p2' : 'p1';
  }
  return state.turn;
}

let aWins = 0;
let bWins = 0;
let draws = 0;
for (let i = 0; i < games; i++) {
  const aIsP1 = i % 2 === 0;
  const config = {
    players: {
      p1: { deck: STARTER_DECKS[aIsP1 ? factionA : factionB] },
      p2: { deck: STARTER_DECKS[aIsP1 ? factionB : factionA] },
    },
  };
  let state = createGame(config, `arena-${i}`);
  let guard = 0;
  while (!state.result && guard++ < 400) {
    const actor = actorOf(state);
    const isA = (actor === 'p1') === aIsP1;
    state = applyMove(state, chooseMove(getView(state, actor), isA ? diffA : diffB));
  }
  const winner = state.result?.winner ?? null;
  if (winner === null) {
    draws++;
  } else if ((winner === 'p1') === aIsP1) {
    aWins++;
  } else {
    bWins++;
  }
}
console.log(
  `${diffA} (${factionA}/alt) vs ${diffB}: ${aWins}W ${bWins}L ${draws}D of ${games} — ` +
    `${((aWins / games) * 100).toFixed(0)}% win rate`,
);
