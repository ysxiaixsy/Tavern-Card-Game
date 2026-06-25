/**
 * THE themable module. Every color, size, glyph and piece of card-frame
 * styling lives here so custom art can replace the programmatic frames later
 * without touching components (see the IP note in docs/BRIEF.md — no CDPR
 * assets, placeholder visuals only).
 */

import type { Ability, Faction, RowKind, WeatherKind } from '../engine/types';
import { color } from './tokens';

/**
 * Legacy palette — now a thin compatibility alias over the design tokens
 * (src/ui/tokens.ts) so any not-yet-fully-migrated screen picks up the
 * Witcher-tavern colors. New code should import from tokens directly.
 */
export const palette = {
  bg: color.bg,
  surface: color.surface,
  surfaceRaised: color.surfaceRaised,
  line: color.line,
  text: color.ink,
  textDim: color.inkDim,
  gold: color.accent,
  goldBright: color.accentBright,
  danger: color.sealRed,
  success: color.buff,
  info: color.debuff,
  weatherTint: color.weatherTint,
  targetGlow: color.targetable,
  overlay: color.overlay,
} as const;

export const factionTheme: Record<Faction, { frame: string; accent: string; label: string }> = {
  neutral: { frame: '#8a7a5c', accent: '#cdbb96', label: 'Neutral' },
  northern_realms: { frame: '#3e6db5', accent: '#7fa8e0', label: 'Northern Realms' },
  nilfgaard: { frame: '#3a3a3a', accent: '#c8a84b', label: 'Nilfgaard' },
  monsters: { frame: '#8c2e2b', accent: '#d96a5a', label: 'Monsters' },
  scoiatael: { frame: '#4e7a3a', accent: '#8cba6a', label: "Scoia'tael" },
  skellige: { frame: '#2f6d7a', accent: '#6fb7c4', label: 'Skellige' },
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
  storm: '⛈️',
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
  mardroeme: '🍄',
  leader: '👑',
} as const;

export const GEM = '◆';

/**
 * Card frame dimensions per rendering context. Aspect ≈ 0.53 to match the real
 * Gwent card art (700×1323). Board/hand keep their heights and only narrow so
 * the board doesn't grow vertically; the large (zoom) card scales up.
 */
export const CARD_SIZE = {
  board: { width: 28, height: 52, name: 7, badge: 14, icon: 8 },
  hand: { width: 56, height: 106, name: 9, badge: 22, icon: 12 },
  large: { width: 200, height: 372, name: 18, badge: 44, icon: 22 },
} as const;

export type CardSizeKind = keyof typeof CARD_SIZE;

/** 4px spacing scale. */
export const sp = (n: number): number => n * 4;
