/**
 * Internal shared utilities for the engine. Not part of the public API.
 */

import { getCardDef } from './data/cards.ts';
import type {
  CardInstance,
  GameState,
  PlayerId,
  PlayerState,
  RowKind,
  WeatherKind,
} from './types.ts';

export const ROW_KINDS: readonly RowKind[] = ['melee', 'ranged', 'siege'];
export const PLAYER_IDS: readonly PlayerId[] = ['p1', 'p2'];

/** Which row(s) each weather kind affects (on BOTH sides of the board). */
export const WEATHER_ROWS: Record<Exclude<WeatherKind, 'clear'>, readonly RowKind[]> = {
  frost: ['melee'],
  fog: ['ranged'],
  rain: ['siege'],
  storm: ['ranged', 'siege'], // Skellige Storm hits both
};

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'p1' ? 'p2' : 'p1';
}

/**
 * Does either player have an active passive leader of `ability`? A passive is
 * "active" until cancelled — Emhyr White Flame's cancel_leader sets leaderUsed,
 * which switches the passive off (the only thing that ever marks these used).
 */
function passiveActive(state: GameState, ability: string): boolean {
  return PLAYER_IDS.some((p) => {
    const ps = state.players[p];
    return getCardDef(ps.leader.defId).leaderAbility === ability && !ps.leaderUsed;
  });
}

/** Eredin the Treacherous (passive): is spy doubling active? (either leader). */
export function spiesAreDoubled(state: GameState): boolean {
  return passiveActive(state, 'spy_double_passive');
}

/** Emhyr Invader of the North (passive): do restore-to-field effects pick randomly? */
export function restoreToFieldIsRandom(state: GameState): boolean {
  return passiveActive(state, 'restore_random_passive');
}

/**
 * Deep-clone a GameState. GameState is plain JSON by contract, so a JSON
 * round-trip is a correct clone and works in every runtime we target
 * (Hermes, V8, Deno) without depending on structuredClone.
 */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** Currently active weather kinds (deduped; 'clear' is never active). */
export function activeWeatherKinds(state: GameState): Exclude<WeatherKind, 'clear'>[] {
  const kinds: Exclude<WeatherKind, 'clear'>[] = [];
  for (const wc of state.weatherCards) {
    const def = getCardDef(wc.defId);
    if (def.weather && def.weather !== 'clear' && !kinds.includes(def.weather)) {
      kinds.push(def.weather);
    }
  }
  return kinds;
}

/** Is `rowKind` under ANY weather, classic or storm (both sides equally)? */
export function isRowUnderWeather(state: GameState, rowKind: RowKind): boolean {
  return activeWeatherKinds(state).some((kind) => WEATHER_ROWS[kind].includes(rowKind));
}

/** Is `rowKind` under classic frost/fog/rain (the "nuke to 1" weathers)? */
export function isRowUnderHardWeather(state: GameState, rowKind: RowKind): boolean {
  return activeWeatherKinds(state).some(
    (kind) => kind !== 'storm' && WEATHER_ROWS[kind].includes(rowKind),
  );
}

/** Is `rowKind` under Skellige Storm (the "halve" weather)? */
export function isRowUnderStorm(state: GameState, rowKind: RowKind): boolean {
  return activeWeatherKinds(state).includes('storm') && WEATHER_ROWS.storm.includes(rowKind);
}

/** Locate a card among a player's three rows. */
export function findInRows(
  ps: PlayerState,
  instanceId: string,
): { rowKind: RowKind; index: number } | null {
  for (const rowKind of ROW_KINDS) {
    const index = ps.rows[rowKind].units.findIndex((u) => u.instanceId === instanceId);
    if (index !== -1) {
      return { rowKind, index };
    }
  }
  return null;
}

/**
 * Valid Decoy targets for `player`: non-hero unit cards on THEIR side of the
 * board. Enemy spies sitting on this side qualify (the classic spy steal);
 * heroes, decoys and special cards never do.
 */
export function decoyTargets(state: GameState, player: PlayerId): CardInstance[] {
  const targets: CardInstance[] = [];
  for (const rowKind of ROW_KINDS) {
    for (const unit of state.players[player].rows[rowKind].units) {
      if (getCardDef(unit.defId).type === 'unit') {
        targets.push(unit);
      }
    }
  }
  return targets;
}

/** Medic revive targets: non-hero unit cards in the player's own graveyard. */
export function medicTargets(ps: PlayerState): CardInstance[] {
  return ps.graveyard.filter((c) => getCardDef(c.defId).type === 'unit');
}

/** Index of the first card of a weather kind in the deck (weather_from_deck leaders), or -1. */
export function weatherIndexInDeck(ps: PlayerState, kind: WeatherKind): number {
  return ps.deck.findIndex((c) => getCardDef(c.defId).weather === kind);
}

/** Draw up to n cards from the top of the deck into the hand (mutates). */
export function drawCards(state: GameState, player: PlayerId, n: number): number {
  const ps = state.players[player];
  let drawn = 0;
  while (drawn < n && ps.deck.length > 0) {
    ps.hand.push(ps.deck.shift() as CardInstance);
    drawn++;
  }
  return drawn;
}
