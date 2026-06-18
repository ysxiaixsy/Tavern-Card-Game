/**
 * THE themable module. Every color, size, glyph and piece of card-frame
 * styling lives here so custom art can replace the programmatic frames later
 * without touching components (see the IP note in docs/BRIEF.md — no CDPR
 * assets, placeholder visuals only).
 */

import type { Ability, Faction, RowKind, WeatherKind } from '../engine/types';

export const palette = {
  bg: '#16100b', // dark tavern wood
  surface: '#241a12',
  surfaceRaised: '#2f2318',
  line: '#4a3826',
  text: '#f0e6d2',
  textDim: '#a08c6e',
  gold: '#d4af6a',
  goldBright: '#f1c87a',
  danger: '#d9534f',
  success: '#7ab648',
  info: '#5b9bd5',
  weatherTint: 'rgba(91, 155, 213, 0.18)',
  targetGlow: '#f1c87a',
  overlay: 'rgba(0, 0, 0, 0.72)',
} as const;

export const factionTheme: Record<Faction, { frame: string; accent: string; label: string }> = {
  neutral: { frame: '#8a7a5c', accent: '#cdbb96', label: 'Neutral' },
  northern_realms: { frame: '#3e6db5', accent: '#7fa8e0', label: 'Northern Realms' },
  nilfgaard: { frame: '#3a3a3a', accent: '#c8a84b', label: 'Nilfgaard' },
  monsters: { frame: '#8c2e2b', accent: '#d96a5a', label: 'Monsters' },
  scoiatael: { frame: '#4e7a3a', accent: '#8cba6a', label: "Scoia'tael" },
};

export const rowIcon: Record<RowKind, string> = {
  melee: '⚔️',
  ranged: '🏹',
  siege: '🏰',
};

export const rowLabel: Record<RowKind, string> = {
  melee: 'Close Combat',
  ranged: 'Ranged',
  siege: 'Siege',
};

export const weatherIcon: Record<WeatherKind, string> = {
  frost: '❄️',
  fog: '🌫️',
  rain: '🌧️',
  clear: '☀️',
};

export const abilityIcon: Record<Ability, string> = {
  spy: '🕵️',
  medic: '⚕️',
  muster: '📣',
  bond: '🔗',
  moral: '🚩',
  horn: '📯',
  agile: '↔️',
  scorch_row: '🔥',
};

/** Glyphs for special card types (shown where a unit shows its strength). */
export const specialIcon = {
  weather: weatherIcon,
  horn: '📯',
  scorch: '🔥',
  decoy: '🎭',
  leader: '👑',
} as const;

export const GEM = '◆';

/** Card frame dimensions per rendering context. */
export const CARD_SIZE = {
  board: { width: 40, height: 52, name: 7, badge: 14, icon: 8 },
  hand: { width: 76, height: 106, name: 9, badge: 22, icon: 12 },
  large: { width: 220, height: 300, name: 18, badge: 44, icon: 22 },
} as const;

export type CardSizeKind = keyof typeof CARD_SIZE;

/** 4px spacing scale. */
export const sp = (n: number): number => n * 4;
