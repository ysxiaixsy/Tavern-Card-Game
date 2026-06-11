/**
 * The AI opponent. `chooseMove(view, difficulty)` — the only entry point.
 *
 * It sees a PlayerView and nothing else (no GameState, no hidden cards) and
 * is deterministic: the same view always produces the same move, which keeps
 * simulations and replays reproducible.
 *
 *   easy   — greedy points: plays its biggest immediate board gain, avoids
 *            spies/weather (they "lose points"), passes naively.
 *   normal — the full heuristic policy (see normal.ts).
 *   hard   — normal's shortlist re-ranked by determinized rollouts (hard.ts).
 */

import { getCardDef } from '../engine/data/cards.ts';
import type { Move, PlayerView } from '../engine/types.ts';
import { chooseMulligan, estimateGain, scoreMoves } from './normal.ts';
import { chooseHardMove } from './hard.ts';

export type Difficulty = 'easy' | 'normal' | 'hard';

export function chooseMove(view: PlayerView, difficulty: Difficulty): Move {
  if (view.legalMoves.length === 0) {
    throw new Error(`ai: no legal moves for ${view.player}`);
  }
  if (view.legalMoves.length === 1) {
    return view.legalMoves[0];
  }
  if (view.phase === 'mulligan' && view.pendingChoice === null) {
    return difficulty === 'easy' ? keepHand(view) : chooseMulligan(view);
  }
  switch (difficulty) {
    case 'easy':
      return chooseEasy(view);
    case 'normal':
      return scoreMoves(view)[0].move;
    case 'hard':
      return chooseHardMove(view);
    default:
      return scoreMoves(view)[0].move;
  }
}

function keepHand(view: PlayerView): Move {
  return (
    view.legalMoves.find((m) => m.type === 'MULLIGAN' && m.cardInstanceIds.length === 0) ??
    view.legalMoves[0]
  );
}

/** Greedy points, no card economy: the authentic tavern rookie. */
function chooseEasy(view: PlayerView): Move {
  const margin = view.you.total - view.opponent.total;

  // Naive pass logic: only when the opponent passed and we're ahead.
  if (view.opponent.passed && margin > 0) {
    const pass = view.legalMoves.find((m) => m.type === 'PASS');
    if (pass) {
      return pass;
    }
  }

  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of view.legalMoves) {
    let score: number;
    switch (move.type) {
      case 'PASS':
        score = -1000; // never passes voluntarily
        break;
      case 'RESOLVE_MEDIC': {
        const card = view.you.graveyard.find((c) => c.instanceId === move.targetInstanceId);
        score = card ? (getCardDef(card.defId).strength ?? 0) : 0; // biggest body
        break;
      }
      case 'USE_LEADER':
        score = -5; // doesn't understand leaders
        break;
      case 'CHOOSE_FIRST_PLAYER':
        score = move.first === view.player ? 1 : 0; // "me first!"
        break;
      default:
        score = estimateGain(view, move); // immediate board delta only
    }
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best ?? view.legalMoves[0];
}
