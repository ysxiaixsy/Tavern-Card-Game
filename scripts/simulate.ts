/**
 * Headless AI-vs-AI simulator: `npm run simulate [seed] [p1Diff] [p2Diff]`
 *
 * Plays the two starter decks against each other with the real M3 agent
 * (easy | normal | hard, default normal vs normal) and prints a readable
 * turn-by-turn log. The agents honour the information model: they only ever
 * see a PlayerView.
 */

import {
  applyMove,
  createGame,
  getCardDef,
  getView,
  MONSTERS_STARTER,
  NORTHERN_REALMS_STARTER,
  type GameState,
  type Move,
  type PlayerId,
  type PlayerView,
} from '../src/engine/index.ts';
import { chooseMove, type Difficulty } from '../src/ai/agent.ts';

const seed = process.argv[2] ?? `sim-${Date.now().toString(36)}`;
const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard'];
function parseDiff(arg: string | undefined, fallback: Difficulty): Difficulty {
  return DIFFS.includes(arg as Difficulty) ? (arg as Difficulty) : fallback;
}
const difficulty: Record<PlayerId, Difficulty> = {
  p1: parseDiff(process.argv[3], 'normal'),
  p2: parseDiff(process.argv[4], 'normal'),
};

const FACTION_TAG: Record<string, string> = {
  northern_realms: 'NR ',
  nilfgaard: 'NG ',
  monsters: 'MON',
  scoiatael: 'ST ',
  neutral: 'NEU',
};

function pickActor(state: GameState): PlayerId {
  if (state.pendingChoice) {
    return state.pendingChoice.player;
  }
  if (state.phase === 'mulligan') {
    return state.players.p1.mulliganDone ? 'p2' : 'p1';
  }
  return state.turn;
}

function cardName(view: PlayerView, zone: 'hand' | 'graveyard', instanceId: string): string {
  const list = zone === 'hand' ? view.you.hand : view.you.graveyard;
  const card = list.find((c) => c.instanceId === instanceId);
  return card ? getCardDef(card.defId).name : instanceId;
}

function describeMove(view: PlayerView, move: Move): string {
  switch (move.type) {
    case 'MULLIGAN':
      return move.cardInstanceIds.length === 0
        ? 'keeps their hand'
        : `redraws ${move.cardInstanceIds.length} card(s)`;
    case 'PASS':
      return 'passes';
    case 'PLAY_CARD': {
      const bits = [cardName(view, 'hand', move.cardInstanceId)];
      if (move.row) {
        bits.push(`→ ${move.row}`);
      }
      if (move.targetInstanceId) {
        bits.push('(decoy swap)');
      }
      return `plays ${bits.join(' ')}`;
    }
    case 'RESOLVE_MEDIC':
      return `revives ${cardName(view, 'graveyard', move.targetInstanceId)}`;
    case 'USE_LEADER': {
      const name = getCardDef(view.you.leader.defId).name;
      return move.targetInstanceId
        ? `uses leader ${name}, restoring ${cardName(view, 'graveyard', move.targetInstanceId)}`
        : `uses leader ${name}`;
    }
    case 'CHOOSE_FIRST_PLAYER':
      return `chooses ${move.first} to go first`;
    default:
      return JSON.stringify(move);
  }
}

// ---------------------------------------------------------------------------

let state = createGame(
  {
    players: {
      p1: { deck: NORTHERN_REALMS_STARTER },
      p2: { deck: MONSTERS_STARTER },
    },
  },
  seed,
);

console.log(`Gwent simulator — seed "${seed}"`);
console.log(
  `p1: Northern Realms (${difficulty.p1})  vs  p2: Monsters (${difficulty.p2})`,
);
console.log(`${state.roundLeader} wins the coin flip\n`);

let guard = 0;
while (!state.result) {
  if (++guard > 500) {
    throw new Error('simulation did not terminate');
  }
  const actor = pickActor(state);
  const view = getView(state, actor);
  const move = chooseMove(view, difficulty[actor]);

  const roundsBefore = state.roundHistory.length;
  const roundLabel = Math.max(state.round, 1);
  const tag = FACTION_TAG[state.players[actor].faction] ?? '???';
  state = applyMove(state, move);

  if (move.type !== 'MULLIGAN') {
    const after = getView(state, actor);
    console.log(
      `[R${roundLabel}] ${actor} ${tag} ${describeMove(view, move)}` +
        `  | board ${after.you.total}:${after.opponent.total}, hand ${after.you.hand.length}`,
    );
  }

  for (let i = roundsBefore; i < state.roundHistory.length; i++) {
    const r = state.roundHistory[i];
    const outcome =
      r.winner === null
        ? 'tied'
        : `won by ${r.winner}${r.tieBrokenByNilfgaard ? ' (Nilfgaard tiebreak)' : ''}`;
    console.log(
      `\n— Round ${r.round}: ${r.totals.p1}:${r.totals.p2}, ${outcome}.` +
        ` Gems p1 ${state.players.p1.gems} | p2 ${state.players.p2.gems}\n`,
    );
  }
}

const result = state.result;
console.log('═'.repeat(60));
if (result.winner) {
  console.log(`${result.winner} (${difficulty[result.winner]}) wins the match!`);
} else {
  console.log('The match is a draw.');
}
console.log(
  `Rounds: ${result.rounds.map((r) => `${r.totals.p1}:${r.totals.p2}`).join('  ')}` +
    `  | final gems p1 ${result.gems.p1} — p2 ${result.gems.p2}`,
);
