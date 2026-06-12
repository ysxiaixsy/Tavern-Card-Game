/**
 * Human-readable card text: ability descriptions, type lines, player labels.
 * Pure lookup helpers shared by the zoom view, leader sheet and pickers.
 */

import { getCardDef } from '../engine/data/cards';
import type { Ability, CardDef, GameState, PlayerId, WeatherKind } from '../engine/types';
import { factionTheme, rowLabel } from './theme';

export const abilityText: Record<Ability, string> = {
  spy: 'Spy: played on the OPPONENT’s side (counts toward their total); you immediately draw 2 cards from your deck.',
  medic: 'Medic: on play, choose a non-hero unit from your graveyard and play it instantly with full effect.',
  muster: 'Muster: on play, also plays every card of its group from your hand and your deck.',
  bond: 'Tight Bond: ×N strength while N same-named bond units share this row.',
  moral: 'Moral Boost: +1 strength to every other unit in this row.',
  horn: 'Commander’s Horn: doubles unit strengths in this row (applies at most once per row).',
  agile: 'Agile: can be played in Close Combat or Ranged; choose on every play.',
  scorch_melee:
    'Scorch – Close Combat: on play, if the opponent’s Close Combat row totals 10 or more, destroys its strongest non-hero unit(s).',
};

const weatherText: Record<WeatherKind, string> = {
  frost: 'Biting Frost: every Close Combat unit’s strength becomes 1 (both sides). Heroes are immune.',
  fog: 'Impenetrable Fog: every Ranged unit’s strength becomes 1 (both sides). Heroes are immune.',
  rain: 'Torrential Rain: every Siege unit’s strength becomes 1 (both sides). Heroes are immune.',
  clear: 'Clear Weather: removes all weather effects from the board.',
};

const WEATHER_NAME: Record<string, string> = {
  frost: 'Biting Frost',
  fog: 'an Impenetrable Fog',
  rain: 'a Torrential Rain',
};

const leaderText: Record<string, string> = {
  weather_from_deck: 'Once per match: play {weather} straight from your deck.',
  clear_weather: 'Once per match: clear every weather effect from the board.',
  scorch_row_leader:
    'Once per match: destroy the enemy’s strongest {row} unit(s) if that row totals 10 or more.',
  row_horn:
    'Once per match: double the strength of your {row} row, as if by a Commander’s Horn (does not stack with one).',
  cancel_leader: 'Once per match: cancel your opponent’s leader ability before they use it.',
  peek_hand: 'Once per match: look at 3 random cards in your opponent’s hand.',
  restore_to_hand: 'Once per match: restore a non-hero unit from your graveyard to your hand.',
  play_from_graveyard:
    'Once per match: play a non-hero unit from your graveyard instantly, with its full effect.',
  steal_from_graveyard: 'Once per match: take a non-hero unit from the ENEMY graveyard into your hand.',
  discard_draw: 'Once per match: discard 2 cards, then draw any card of your choice from your deck.',
  draw_extra_start: 'Automatic: draw an extra card at the start of the match.',
};

/** Leader ability text with its weather/row blanks filled in. */
export function leaderAbilityText(def: CardDef): string {
  if (!def.leaderAbility) {
    return '';
  }
  const rowFill = def.leaderHornRow ?? def.leaderScorchRow;
  let text = leaderText[def.leaderAbility] ?? '';
  text = text.replace('{weather}', def.leaderWeather ? WEATHER_NAME[def.leaderWeather] : 'weather');
  text = text.replace('{row}', rowFill ? rowLabel[rowFill] : 'chosen');
  return text;
}

/** Full description lines for the zoomed card view. */
export function describeCard(defId: string): string[] {
  const def = getCardDef(defId);
  const lines: string[] = [];
  if (def.type === 'hero') {
    lines.push('Hero: immune to every effect, helpful or harmful.');
  }
  if (def.type === 'weather' && def.weather) {
    lines.push(weatherText[def.weather]);
  }
  if (def.type === 'horn') {
    lines.push(abilityText.horn);
  }
  if (def.type === 'scorch') {
    lines.push(
      'Scorch: destroys ALL non-hero units tied for the highest strength on the entire board, both sides.',
    );
  }
  if (def.type === 'decoy') {
    lines.push(
      'Decoy: swap with a non-hero unit on your side of the board — it returns to your hand (enemy spies included).',
    );
  }
  if (def.type === 'leader' && def.leaderAbility) {
    lines.push(leaderAbilityText(def));
  }
  for (const ability of def.abilities) {
    lines.push(abilityText[ability]);
  }
  if (lines.length === 0) {
    lines.push('No special ability. Pure, dependable strength.');
  }
  return lines;
}

/** "Northern Realms · Hero · Close Combat · 10" style subtitle. */
export function cardTypeLine(def: CardDef): string {
  const bits: string[] = [factionTheme[def.faction].label];
  if (def.type === 'unit' || def.type === 'hero') {
    bits.push(def.type === 'hero' ? 'Hero' : 'Unit');
    bits.push(def.row === 'agile' ? 'Agile (melee/ranged)' : def.row ? rowLabel[def.row] : '');
    bits.push(`Strength ${def.strength ?? 0}`);
  } else {
    bits.push(def.type === 'weather' ? 'Weather' : def.type === 'leader' ? 'Leader' : 'Special');
  }
  return bits.filter(Boolean).join(' · ');
}

export function playerLabel(state: GameState, p: PlayerId): string {
  const faction = factionTheme[state.players[p].faction].label;
  return `${p === 'p1' ? 'Player 1' : 'Player 2'} (${faction})`;
}
