/**
 * Core type definitions for the Witcher 3 Gwent engine.
 *
 * PURITY CONTRACT
 * ---------------
 * Nothing under src/engine/ may import React, React Native, Node, or Deno
 * APIs. `GameState` is plain JSON (no classes, Maps, Dates, functions) so it
 * can be persisted as Postgres jsonb, sent over the wire, and cloned with a
 * JSON round-trip. All randomness flows through the PRNG state embedded in
 * GameState (see rng.ts) — never Math.random(), never Date.now().
 *
 * Internal imports use explicit `.ts` extensions so the same source runs
 * unchanged under Metro (the Expo app) and Deno (Supabase Edge Functions).
 *
 * MOVE / pendingChoice FLOW
 * -------------------------
 * `applyMove(state, move)` is the only way the game advances. Moves are
 * serializable JSON and carry the acting player. A move is always *complete*:
 * every choice a card needs (decoy target, agile row, medic revive pick) is
 * in the payload — the engine never prompts mid-move.
 *
 * The one multi-step interaction is the medic chain. Playing a medic whose
 * graveyard has at least one legal target does NOT pass the turn; instead it
 * sets `state.pendingChoice = { kind: 'medic_revive', ... }`. While a
 * pendingChoice is set, getLegalMoves returns only RESOLVE_MEDIC moves for
 * that player, and applyMove rejects everything else. Resolving plays the
 * revived card with full effects; if the revived card is itself a medic with
 * a legal target, a new pendingChoice is set (the chain continues). Only when
 * the chain is exhausted does the turn pass. A medic played with no legal
 * target resolves as a plain unit (per the brief, skipping is only allowed —
 * and here, automatic — when the graveyard has no legal target).
 *
 * The Scoia'tael "choose who goes first" perk uses the same mechanism with
 * `kind: 'choose_first_player'`, resolved by a CHOOSE_FIRST_PLAYER move
 * before mulligans begin.
 */

export type PlayerId = 'p1' | 'p2';

export type Faction =
  | 'neutral'
  | 'northern_realms'
  | 'nilfgaard'
  | 'monsters'
  | 'scoiatael';

export type CardType =
  | 'unit'
  | 'hero'
  | 'weather'
  | 'horn'
  | 'scorch'
  | 'decoy'
  | 'leader';

/** The three physical rows on each player's side of the board. */
export type RowKind = 'melee' | 'ranged' | 'siege';

/** A unit's printed row. Agile units pick melee or ranged on each play. */
export type UnitRow = RowKind | 'agile';

/**
 * Weather card kinds. 'clear' exists only on Clear Weather cards; it is never
 * an *active* weather. frost→melee, fog→ranged, rain→siege.
 */
export type WeatherKind = 'frost' | 'fog' | 'rain' | 'clear';

export type Ability =
  | 'spy'
  | 'medic'
  | 'muster'
  | 'bond' // Tight Bond
  | 'moral' // Moral Boost
  | 'horn' // Commander's Horn as a unit ability (e.g. Dandelion)
  | 'agile'
  | 'scorch_row'; // unit-scorch (Villentretenmerth/Toad/Schirru): on play, scorch the opponent row named by CardDef.scorchRow if its total ≥ 10

export type LeaderAbilityId =
  | 'weather_from_deck' // play this leader's weather kind straight from your deck (see CardDef.leaderWeather)
  | 'clear_weather' // remove all active weather
  | 'scorch_row_leader' // destroy enemy's strongest unit(s) in leaderScorchRow if that row totals 10+
  | 'row_horn' // double one of YOUR rows like a Commander's Horn (see CardDef.leaderHornRow)
  | 'cancel_leader' // cancel the opponent's (unused) leader ability
  | 'peek_hand' // look at 3 random cards in the opponent's hand
  | 'restore_to_hand' // restore a non-hero unit from your graveyard to your hand
  | 'play_from_graveyard' // play a non-hero unit from your graveyard instantly, full effects
  | 'steal_from_graveyard' // take a non-hero unit from the OPPONENT's graveyard into your hand
  | 'discard_draw' // discard 2 cards, then draw 1 card of your choice from your deck
  | 'draw_extra_start'; // auto: draw an extra card at match start (never an on-demand move)

/** Static card definition (see data/cards.ts). */
export interface CardDef {
  id: string;
  name: string;
  faction: Faction;
  type: CardType;
  /** Required for unit/hero. Also fixes the row a spy lands on (opponent side). */
  row?: UnitRow;
  /** Printed strength. Required for unit/hero (0 allowed, e.g. Avallac'h). */
  strength?: number;
  abilities: Ability[];
  /**
   * Cards sharing a musterGroup are all played together when any one of them
   * is played (from hand AND deck). Models W3's name-prefix matching: the
   * Crones and the "Vampire:" cards have different names but one group.
   */
  musterGroup?: string;
  /**
   * One-directional summon: on play, also muster every card of this group
   * from hand AND deck — without this card being a member of that group.
   * Gaunter O'Dimm summons the "Darkness" cards but is never summoned by them.
   */
  summonsGroup?: string;
  /** scorch_row units: which ENEMY row they scorch (≥10). */
  scorchRow?: RowKind;
  /**
   * Summon Avenger: when this unit leaves the board into a graveyard (killed
   * or cleared at round end), the named card is placed on its owner's board at
   * the start of the NEXT round. Cow → Bovine Defense Force, Kambi → Hemdall.
   */
  summonAvenger?: string;
  /** Deck-building copy limit. Default 1. */
  maxCopiesPerDeck?: number;
  /** Weather cards only. */
  weather?: WeatherKind;
  /** Leader cards only. */
  leaderAbility?: LeaderAbilityId;
  /** weather_from_deck leaders: which kind they fetch. */
  leaderWeather?: Exclude<WeatherKind, 'clear'>;
  /** row_horn leaders: which of your rows they double. */
  leaderHornRow?: RowKind;
  /** scorch_row_leader leaders: which ENEMY row they scorch. */
  leaderScorchRow?: RowKind;
}

/** A concrete copy of a card in one game. instanceIds are unique per game. */
export interface CardInstance {
  instanceId: string;
  defId: string;
}

/** A weather card sitting in the shared weather area. */
export interface WeatherCardOnBoard extends CardInstance {
  /** Who played it — Clear Weather / round end send it to this graveyard. */
  owner: PlayerId;
}

/**
 * One row on one side of the board. `units` keeps placement order; a Decoy
 * swap puts the decoy at the exact index of the unit it replaced. The horn
 * slot holds at most one Commander's Horn special card.
 */
export interface RowState {
  units: CardInstance[];
  horn: CardInstance | null;
}

export interface PlayerState {
  faction: Faction;
  leader: CardInstance;
  leaderUsed: boolean;
  gems: number;
  hand: CardInstance[];
  /** deck[0] is the top of the deck (next card drawn). Contents+order hidden. */
  deck: CardInstance[];
  graveyard: CardInstance[];
  rows: Record<RowKind, RowState>;
  passed: boolean;
  mulliganDone: boolean;
  /** How many cards this player swapped during the mulligan phase (max 2). */
  mulligansUsed: number;
  /**
   * Opponent hand instanceIds revealed to THIS player (Emhyr's peek). Used by
   * getView to show those cards face-up; everything else stays hidden.
   */
  knownOpponentCardIds: string[];
}

export type GamePhase = 'mulligan' | 'play' | 'finished';

export type PendingChoice =
  | {
      kind: 'medic_revive';
      player: PlayerId;
      /** The medic that triggered the choice (for UI display). */
      medicInstanceId: string;
    }
  | { kind: 'choose_first_player'; player: PlayerId };

export interface RoundResult {
  round: number;
  totals: Record<PlayerId, number>;
  /** null = true tie (both lose a gem). */
  winner: PlayerId | null;
  /** Set when a tied score was converted into a win by the Nilfgaard perk. */
  tieBrokenByNilfgaard?: boolean;
}

export interface MatchResult {
  /** null = draw (both players hit 0 gems simultaneously). */
  winner: PlayerId | null;
  gems: Record<PlayerId, number>;
  rounds: RoundResult[];
}

/** Deck list as submitted by a player: a leader plus card def ids (repeats allowed). */
export interface DeckList {
  leaderId: string;
  /** Card def ids; include a def id once per copy. */
  cardIds: string[];
}

export interface GameConfig {
  players: Record<PlayerId, { deck: DeckList }>;
}

export interface GameState {
  /** Engine schema version, bump on breaking GameState changes. */
  v: 1;
  seed: string;
  /** Serialized PRNG state (uint32). See rng.ts. */
  rngState: number;
  config: GameConfig;
  phase: GamePhase;
  /** 1-based round number; 0 while in the mulligan phase. */
  round: number;
  /** Whose action the game is waiting on (also during mulligan/pendingChoice). */
  turn: PlayerId;
  /** Who leads (plays first in) the current round. */
  roundLeader: PlayerId;
  players: Record<PlayerId, PlayerState>;
  /** Shared weather area covering both sides. Active kinds derive from this. */
  weatherCards: WeatherCardOnBoard[];
  /** Avengers queued by Summon-Avenger cards, placed at the next round start. */
  pendingSummons: { player: PlayerId; card: CardInstance }[];
  pendingChoice: PendingChoice | null;
  roundHistory: RoundResult[];
  /** Non-null exactly when phase === 'finished'. */
  result: MatchResult | null;
  /** Number of applyMove calls accepted so far (server sync/debug aid). */
  moveCount: number;
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export interface ChooseFirstPlayerMove {
  type: 'CHOOSE_FIRST_PLAYER';
  player: PlayerId;
  first: PlayerId;
}

export interface MulliganMove {
  type: 'MULLIGAN';
  player: PlayerId;
  /** 0–2 distinct cards to swap. Submitting [] keeps the dealt hand. */
  cardInstanceIds: string[];
}

export interface PlayCardMove {
  type: 'PLAY_CARD';
  player: PlayerId;
  cardInstanceId: string;
  /** Required for agile units and Commander's Horn; ignored otherwise. */
  row?: RowKind;
  /** Required for Decoy (the board unit to pick up). */
  targetInstanceId?: string;
}

export interface ResolveMedicMove {
  type: 'RESOLVE_MEDIC';
  player: PlayerId;
  /** Non-hero unit in the acting player's graveyard to revive and replay. */
  targetInstanceId: string;
  /** Required when the revived unit is agile. */
  row?: RowKind;
}

export interface UseLeaderMove {
  type: 'USE_LEADER';
  player: PlayerId;
  /** Graveyard-targeting leaders (restore_to_hand, play_from_graveyard, steal_from_graveyard). */
  targetInstanceId?: string;
  /** Required when play_from_graveyard revives an agile unit. */
  row?: RowKind;
  /** discard_draw: exactly 2 of your hand cards to discard. */
  discardInstanceIds?: string[];
  /** discard_draw: the card (by def id) to fetch from your deck. */
  drawDefId?: string;
}

export interface PassMove {
  type: 'PASS';
  player: PlayerId;
}

export type Move =
  | ChooseFirstPlayerMove
  | MulliganMove
  | PlayCardMove
  | ResolveMedicMove
  | UseLeaderMove
  | PassMove;

// ---------------------------------------------------------------------------
// Player view (information model)
// ---------------------------------------------------------------------------

/** A board card plus its current effective strength (after weather/bond/moral/horn). */
export interface UnitView extends CardInstance {
  effectiveStrength: number;
}

export interface RowView {
  units: UnitView[];
  horn: CardInstance | null;
  total: number;
}

export interface SideView {
  faction: Faction;
  gems: number;
  passed: boolean;
  leader: CardInstance;
  leaderUsed: boolean;
  deckCount: number;
  graveyard: CardInstance[];
  rows: Record<RowKind, RowView>;
  total: number;
}

/**
 * Everything one player may know. Hidden: opponent hand contents (except
 * Emhyr-revealed cards) and BOTH decks' contents/order — you only get counts,
 * even for your own deck. Public: board, graveyards, gems, weather, leaders,
 * counts. The AI receives only a PlayerView, never GameState.
 */
export interface PlayerView {
  player: PlayerId;
  phase: GamePhase;
  round: number;
  turn: PlayerId;
  pendingChoice: PendingChoice | null;
  you: SideView & { hand: CardInstance[]; mulliganDone: boolean; mulligansUsed: number };
  opponent: SideView & { handCount: number; revealedHand: CardInstance[] };
  /** 'clear' is never an active weather — it only exists on cards. */
  weather: { kinds: Exclude<WeatherKind, 'clear'>[]; cards: WeatherCardOnBoard[] };
  roundHistory: RoundResult[];
  result: MatchResult | null;
  /** Legal moves for the viewing player right now ([] when not their turn). */
  legalMoves: Move[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type GwentErrorCode =
  | 'INVALID_CONFIG'
  | 'GAME_FINISHED'
  | 'WRONG_PHASE'
  | 'NOT_YOUR_TURN'
  | 'PENDING_CHOICE'
  | 'ALREADY_PASSED'
  | 'CARD_NOT_FOUND'
  | 'ILLEGAL_MOVE'
  | 'INVALID_TARGET'
  | 'LEADER_UNAVAILABLE';

export class GwentError extends Error {
  readonly code: GwentErrorCode;
  constructor(code: GwentErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'GwentError';
    this.code = code;
  }
}
