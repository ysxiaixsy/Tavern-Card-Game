/**
 * Public engine API. Everything the app, the AI, the simulator and the
 * Supabase Edge Functions are allowed to touch lives here.
 *
 *   createGame(config, seed)      → GameState   (mulligan phase)
 *   getLegalMoves(state, player)  → Move[]
 *   applyMove(state, move)        → GameState   (pure; throws GwentError)
 *   getView(state, player)        → PlayerView  (hides hidden information)
 *   isTerminal(state)             → MatchResult | null
 */

export { applyMove } from './apply.ts';
export { CARD_DEFS, getCardDef, hasCardDef } from './data/cards.ts';
export {
  MONSTERS_STARTER,
  NORTHERN_REALMS_STARTER,
  STARTER_DECKS,
} from './data/decks.ts';
export { createGame, isTerminal, validateDeck } from './game.ts';
export { getLegalMoves } from './legal.ts';
export { rowTotal, rowUnitViews, sideTotal } from './strength.ts';
export { getView } from './view.ts';
export * from './types.ts';
