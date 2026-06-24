/**
 * Design tokens — the single source of truth for the GWENT UI.
 *
 * Art direction: "Witcher tavern" — a material world of dark oak, aged
 * parchment, gold-leaf / brass, and wax-seal red, with the six faction colors
 * used as heraldic accents. This file REPLACES the ad-hoc, per-screen values
 * (≈13 font sizes, ≈12 radii, hardcoded `#241a12`/`#3a2d14`, the `targetGlow`
 * duplicate) with one reconciled, role-named set.
 *
 * Nothing consumes this yet — `theme.ts` and the components migrate onto it in
 * Phase 3. Pure values + RN style fragments; no component imports.
 */

import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Color — by ROLE, not by hue. (Old palette values are reconciled into these.)
// ---------------------------------------------------------------------------
export const color = {
  // Surfaces — layered dark oak (deepest table → lifted panel) + parchment.
  bg: '#130d08', //            the table: deepest oak, near-black
  surface: '#20160e', //       standard panel / strip
  surfaceRaised: '#2c2014', //  lifted panel / chip / hand tray
  surfaceSunken: '#0d0905', //  recessed wells (board rows behind cards)
  parchment: '#e7d8b6', //     aged parchment — light material (sheets, zoom backs)
  parchmentDim: '#d2c09a', //  shaded parchment

  // Edges — oak seam + brass keyline (the "frame" language).
  line: '#46341f', //          oak seam / hairline divider
  edgeBrass: '#806026', //     brass keyline (inner frame accent)

  // Ink — text on each material.
  ink: '#f1e7d0', //           primary parchment-white on dark
  inkDim: '#a3906d', //        secondary / muted
  inkOnAccent: '#20160e', //   text on gold/brass (was hardcoded #241a12 ×10)
  inkOnParchment: '#2b1d0f', // dark ink on parchment panels

  // Accent — gold leaf / brass.
  accent: '#c8a24a', //        gold leaf
  accentBright: '#efce86', //  lit gold (was goldBright AND targetGlow)
  accentDim: '#8f7434', //     tarnished brass

  // Signal — wax-seal red (material, deep) for danger / pass / loss.
  sealRed: '#9c2b24',
  sealRedBright: '#c4423a',

  // Outcome.
  win: '#c8a24a', //           gold (kept a round)
  loss: '#9c2b24', //          wax red (lost a round)
  neutral: '#a3906d', //       tie / inert

  // Effect highlights. Strength numerals read green-up / red-down:
  // buffed → `buff`, weakened → `sealRed` (kept from today). `debuff`/
  // `weatherTint` (cold steel) are reserved for the WEATHER row wash, not text.
  buff: '#8fb45a', //          strength up (vigor green)
  debuff: '#7c98ad', //        weather / weakened-row accent (cold steel)
  targetable: '#efce86', //    valid target glow (gold)
  weatherTint: 'rgba(124,152,173,0.16)', // cold steel wash over a weathered row

  // Scrim.
  overlay: 'rgba(13,9,5,0.74)', // warm near-black modal scrim
} as const;

/** Faction heraldry — frame + accent + label (kept; already has character). */
export const faction = {
  neutral: { frame: '#8a7a5c', accent: '#cdbb96', label: 'Neutral' },
  northern_realms: { frame: '#3e6db5', accent: '#7fa8e0', label: 'Northern Realms' },
  nilfgaard: { frame: '#2c2c2c', accent: '#c8a84b', label: 'Nilfgaard' },
  monsters: { frame: '#8c2e2b', accent: '#d96a5a', label: 'Monsters' },
  scoiatael: { frame: '#4e7a3a', accent: '#8cba6a', label: "Scoia'tael" },
  skellige: { frame: '#2f6d7a', accent: '#6fb7c4', label: 'Skellige' },
} as const;

// ---------------------------------------------------------------------------
// Typography — Cinzel (engraved caps) for display/titles/numerals, Spectral
// (warm humanist serif) for body. NOTE Cinzel is CAPS-ONLY (no lowercase), so
// it's only for display/title/heading/numeral; all lowercase body/label/caption
// text uses Spectral. Loaded via expo-font in Phase 3; each weight is registered
// as its own family there and these names are finalized.
// ---------------------------------------------------------------------------
export const font = {
  display: 'Cinzel_400Regular', //      titles, headings, card-strength numerals
  displayBold: 'Cinzel_700Bold', //     hero display + bold numerals
  body: 'Spectral_400Regular', //       body, captions
  bodyMedium: 'Spectral_500Medium', //  labels, emphasis
} as const;

/** Reconciled type scale (old inline sizes 7→56 collapse into these roles). */
export const typography = {
  hero: { fontFamily: font.displayBold, fontSize: 44, letterSpacing: 4 },
  display: { fontFamily: font.displayBold, fontSize: 28, letterSpacing: 2 },
  title: { fontFamily: font.display, fontSize: 20, letterSpacing: 1 },
  heading: { fontFamily: font.display, fontSize: 16, letterSpacing: 0.5 },
  body: { fontFamily: font.body, fontSize: 14 },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 14 },
  label: { fontFamily: font.bodyMedium, fontSize: 12, letterSpacing: 1 }, // small-caps feel
  caption: { fontFamily: font.body, fontSize: 11 },
  /** Card strength / scores — engraved numerals; size set per context. */
  numeral: { fontFamily: font.displayBold, letterSpacing: 0 },
} as const satisfies Record<string, TextStyle>;

// ---------------------------------------------------------------------------
// Spacing — keep the existing 4px scale, add named steps.
// ---------------------------------------------------------------------------
export const sp = (n: number): number => n * 4;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// ---------------------------------------------------------------------------
// Radius — reconciled scale (old 4..26 → these). Cards stay nearly square-cut.
// ---------------------------------------------------------------------------
export const radius = { none: 0, sm: 4, md: 8, lg: 14, pill: 999 } as const;

// ---------------------------------------------------------------------------
// Borders & the "frame" material (oak seam + brass keyline).
// ---------------------------------------------------------------------------
export const border = {
  hair: StyleSheet.hairlineWidth,
  thin: 1,
  frame: 1.5,
  bold: 2.5,
} as const;

/** Panel frame: oak border now; the brass inner keyline is drawn by <Panel>. */
export const frame = {
  border: { borderWidth: border.thin, borderColor: color.line } satisfies ViewStyle,
  keyline: color.edgeBrass,
} as const;

// ---------------------------------------------------------------------------
// Elevation — board stays flat; only floating things (sheets, menus) lift.
// ---------------------------------------------------------------------------
export const elevation = {
  flat: {} satisfies ViewStyle,
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  } satisfies ViewStyle,
  overlay: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  } satisfies ViewStyle,
} as const;

// ---------------------------------------------------------------------------
// Interaction states — uniform default/selected/disabled/targetable language.
// ---------------------------------------------------------------------------
export const state = {
  selected: { borderColor: color.accentBright, borderWidth: border.bold } satisfies ViewStyle,
  targetable: { borderColor: color.targetable, borderWidth: border.bold } satisfies ViewStyle,
  disabled: { opacity: 0.45 } satisfies ViewStyle,
  pressed: { opacity: 0.85 } satisfies ViewStyle,
} as const;

// ---------------------------------------------------------------------------
// Motion — durations for the existing Animated primitives (Phase 4 extends).
// ---------------------------------------------------------------------------
export const motion = { fast: 120, base: 220, slow: 360 } as const;
