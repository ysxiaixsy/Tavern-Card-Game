/**
 * Headless AI-vs-AI simulator: `npm run simulate [seed]`
 *
 * Plays the two starter decks against each other with a tiny placeholder bot
 * (the real heuristic AI lands in M3) and prints a readable turn-by-turn log.
 * The bot honours the information model: it only ever sees a PlayerView.
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
import { rngInt, seedToRngState } from '../src/engine/rng.ts';

const seed = process.argv[2] ?? `sim-${Date.now().toString(36)}`;

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

/** Placeholder bot: spies first, simple pass logic, otherwise random card. */
function chooseMove(view: PlayerView, rngState: number): [Move, number] {
  const moves = view.legalMoves;

  if (view.phase === 'mulligan') {
    return [moves.find((m) => m.type === 'MULLIGAN')!, rngState];
  }
  if (view.pendingChoice?.kind === 'medic_revive') {
    // Revive priority: spy > strongest unit.
    const revives = moves.filter((m) => m.type === 'RESOLVE_MEDIC');
    const bySpy = revives.find((m) =>
      getCardDef(graveDef(view, m.targetInstanceId)).abilities.includes('spy'),
    );
    if (bySpy) {
      return [bySpy, rngState];
    }
    revives.sort(
      (a, b) =>
        (getCardDef(graveDef(view, b.targetInstanceId)).strength ?? 0) -
        (getCardDef(graveDef(view, a.targetInstanceId)).strength ?? 0),
    );
    return [revives[0], rngState];
  }

  // Opponent passed and we lead → lock the round in.
  if (view.opponent.passed && view.you.total > view.opponent.total) {
    return [{ type: 'PASS', player: view.player }, rngState];
  }

  // Spies are near-free card advantage: always first.
  const spyMove = moves.find(
    (m) =>
      m.type === 'PLAY_CARD' &&
      getCardDef(handDef(view, m.cardInstanceId)).abilities.includes('spy'),
  );
  if (spyMove) {
    return [spyMove, rngState];
  }

  const plays = moves.filter((m) => m.type !== 'PASS');
  if (plays.length === 0) {
    return [{ type: 'PASS', player: view.player }, rngState];
  }

  // Occasionally pass when ahead (crude card economy); otherwise random play.
  let s = rngState;
  if (view.you.total > view.opponent.total + 5) {
    const [roll, next] = rngInt(s, 10);
    s = next;
    if (roll === 0) {
      return [{ type: 'PASS', player: view.player }, s];
    }
  }
  const [index, next] = rngInt(s, plays.length);
  return [plays[index], next];
}

function handDef(view: PlayerView, instanceId: string): string {
  const card = view.you.hand.find((c) => c.instanceId === instanceId);
  if (!card) {
    throw new Error(`simulator: ${instanceId} not in hand`);
  }
  return card.defId;
}

function graveDef(view: PlayerView, instanceId: string): string {
  const card = view.you.graveyard.find((c) => c.instanceId === instanceId);
  if (!card) {
    throw new Error(`simulator: ${instanceId} not in graveyard`);
  }
  return card.defId;
}

function describeMove(view: PlayerView, move: Move): string {
  switch (move.type) {
    case 'MULLIGAN':
      return `keeps their hand`;
    case 'PASS':
      return 'passes';
    case 'PLAY_CARD': {
      const def = getCardDef(handDef(view, move.cardInstanceId));
      const bits = [def.name];
      if (move.row) {
        bits.push(`→ ${move.row}`);
      }
      if (move.targetInstanceId) {
        bits.push(`(target ${move.targetInstanceId})`);
      }
      return `plays ${bits.join(' ')}`;
    }
    case 'RESOLVE_MEDIC': {
      const def = getCardDef(graveDef(view, move.targetInstanceId));
      return `revives ${def.name}`;
    }
    case 'USE_LEADER': {
      const name = getCardDef(view.you.leader.defId).name;
      return move.targetInstanceId
        ? `uses leader ${name}, restoring ${getCardDef(graveDef(view, move.targetInstanceId)).name}`
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
let botRng = seedToRngState(`bot-${seed}`);

console.log(`Gwent simulator — seed "${seed}"`);
console.log(`p1: Northern Realms (Foltest)  vs  p2: Monsters (Eredin)`);
console.log(`${state.roundLeader} wins the coin flip\n`);

let guard = 0;
while (!state.result) {
  if (++guard > 1000) {
    throw new Error('simulation did not terminate');
  }
  const actor = pickActor(state);
  const view = getView(state, actor);
  const [move, nextRng] = chooseMove(view, botRng);
  botRng = nextRng;

  const roundsBefore = state.roundHistory.length;
  const roundLabel = Math.max(state.round, 1); // capture BEFORE the move advances rounds
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
  console.log(`${result.winner} wins the match!`);
} else {
  console.log('The match is a draw.');
}
console.log(
  `Rounds: ${result.rounds.map((r) => `${r.totals.p1}:${r.totals.p2}`).join('  ')}` +
    `  | final gems p1 ${result.gems.p1} — p2 ${result.gems.p2}`,
);
