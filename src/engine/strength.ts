/**
 * Strength calculation. Applied per unit, in this exact order (per the brief):
 *
 *   1. printed strength — heroes stop here, immune to everything below
 *   2. weather       → classic weather sets the strength to 1; Skellige Storm
 *                      (ranged+siege) halves it to ceil(s/2), min 1. A King
 *                      Bran player who has tapped his leader halves ALL weather
 *                      for his side (so even frost/fog/rain only halve).
 *   3. Tight Bond    → current × n (n = same-named bond units in the row)
 *   4. Moral Boost   → +1 per OTHER moral-boost unit in the same row
 *   5. Horn          → ×2 if the row is horned, at most once per row no
 *                      matter how many horn sources are present
 *
 * Worked example (encoded as a test): a row under Biting Frost containing
 * three bonded 6-strength units, one moral-boost unit and a horn ⇒ each
 * bonded unit = ((1 × 3) + 1) × 2 = 8.
 *
 * Decoys on the board are always 0. A horn doubles its row at most once and
 * never buffs its OWN source card: a lone Dandelion doubles the rest of his
 * row but not himself, while a separate Commander's Horn card (or a second
 * horn unit) still doubles him. (Same self-exclusion principle as moral.)
 */

import { getCardDef } from './data/cards.ts';
import { isRowUnderHardWeather, isRowUnderStorm, ROW_KINDS } from './helpers.ts';
import type { GameState, PlayerId, RowKind, UnitView } from './types.ts';

/** How weather reduces a unit's base strength on this side+row. */
type WeatherMode = 'none' | 'nuke' | 'halve';

function weatherModeFor(state: GameState, side: PlayerId, rowKind: RowKind): WeatherMode {
  const hard = isRowUnderHardWeather(state, rowKind);
  const storm = isRowUnderStorm(state, rowKind);
  if (!hard && !storm) {
    return 'none';
  }
  // King Bran (once tapped) softens ALL weather on his side to a halving.
  const leaderDef = getCardDef(state.players[side].leader.defId);
  const kingBran = state.players[side].leaderUsed && leaderDef.leaderAbility === 'halve_weather';
  if (kingBran) {
    return 'halve';
  }
  return hard ? 'nuke' : 'halve'; // hard weather wins over storm
}

/** Effective strengths for every card in one row, in placement order. */
export function rowUnitViews(state: GameState, side: PlayerId, rowKind: RowKind): UnitView[] {
  const row = state.players[side].rows[rowKind];
  const weatherMode = weatherModeFor(state, side, rowKind);

  // Row-wide modifiers, computed once. Heroes can PROVIDE row effects (e.g.
  // Isengrim's moral boost) — immunity only means they never RECEIVE them.
  // Horn sources on the row. The Horn special card in the slot is always an
  // "other" source; horn-ability units (Dandelion) must exclude themselves.
  const hornCardPresent = row.horn !== null;
  const hornAbilityCount = row.units.filter((u) =>
    getCardDef(u.defId).abilities.includes('horn'),
  ).length;
  const moralCount = row.units.filter((u) =>
    getCardDef(u.defId).abilities.includes('moral'),
  ).length;
  const bondCounts: Record<string, number> = {};
  for (const unit of row.units) {
    const def = getCardDef(unit.defId);
    if (def.abilities.includes('bond')) {
      bondCounts[unit.defId] = (bondCounts[unit.defId] ?? 0) + 1;
    }
  }

  return row.units.map((unit) => {
    const def = getCardDef(unit.defId);

    if (def.type === 'hero') {
      return { ...unit, effectiveStrength: def.strength ?? 0 };
    }
    if (def.type !== 'unit') {
      // Only Decoys can occupy a unit slot besides units/heroes.
      return { ...unit, effectiveStrength: 0 };
    }

    let strength = def.strength ?? 0;
    if (weatherMode === 'nuke') {
      strength = 1;
    } else if (weatherMode === 'halve') {
      strength = Math.max(1, Math.ceil(strength / 2));
    }
    if (def.abilities.includes('bond')) {
      strength *= bondCounts[unit.defId] ?? 1;
    }
    const moralFromOthers = moralCount - (def.abilities.includes('moral') ? 1 : 0);
    strength += moralFromOthers;
    // Doubled if any horn source other than this card itself is on the row.
    const hornFromOthers =
      hornCardPresent || hornAbilityCount - (def.abilities.includes('horn') ? 1 : 0) > 0;
    if (hornFromOthers) {
      strength *= 2;
    }
    return { ...unit, effectiveStrength: strength };
  });
}

export function rowTotal(state: GameState, side: PlayerId, rowKind: RowKind): number {
  return rowUnitViews(state, side, rowKind).reduce((sum, u) => sum + u.effectiveStrength, 0);
}

export function sideTotal(state: GameState, side: PlayerId): number {
  return ROW_KINDS.reduce((sum, rowKind) => sum + rowTotal(state, side, rowKind), 0);
}
