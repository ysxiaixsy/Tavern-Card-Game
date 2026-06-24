/**
 * Hand-drawn icon set (react-native-svg) replacing the emoji maps. One glyph
 * per game concept on a 24×24 grid; outline glyphs inherit the stroke, solid
 * glyphs (gem/star/crown/flame) fill with the color. Use:
 *   <Icon name="sword" size={12} color={faction.accent} />
 *
 * First pass — recognizable at board size; refined in the Phase 4 polish.
 */

import React from 'react';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { color as C } from '../tokens';

export type IconName =
  | 'sword' // melee
  | 'bow' // ranged
  | 'tower' // siege
  | 'frost'
  | 'fog'
  | 'rain'
  | 'storm'
  | 'clear'
  | 'spy'
  | 'medic'
  | 'muster'
  | 'bond'
  | 'moral'
  | 'horn'
  | 'agile'
  | 'scorch'
  | 'decoy'
  | 'crown' // leader
  | 'gem'
  | 'grave'
  | 'hand'
  | 'deck'
  | 'close'
  | 'star'; // hero

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 16, color = C.ink }: Props): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPHS[name](color)}
    </Svg>
  );
}

const fill = (c: string) => ({ fill: c, stroke: 'none' as const });

const GLYPHS: Record<IconName, (c: string) => React.JSX.Element> = {
  sword: () => (
    <>
      <Path d="M12 3 L12 13" />
      <Path d="M8.5 13 L15.5 13" />
      <Path d="M12 13 L12 19" />
      <Circle cx={12} cy={20.5} r={1.3} />
    </>
  ),
  bow: () => (
    <>
      <Path d="M8 4 C 13 7, 13 17, 8 20" />
      <Path d="M8 4 L8 20" />
      <Path d="M6 12 H18" />
      <Path d="M15 9 L18 12 L15 15" />
    </>
  ),
  tower: () => (
    <>
      <Path d="M5 21 V11 H8 V9 H11 V11 H13 V9 H16 V11 H19 V21 Z" />
      <Path d="M10 21 V16 H14 V21" />
    </>
  ),
  frost: () => (
    <>
      <Path d="M12 3 V21" />
      <Path d="M4.2 7.5 L19.8 16.5" />
      <Path d="M19.8 7.5 L4.2 16.5" />
    </>
  ),
  fog: () => (
    <>
      <Path d="M5 9 H19" />
      <Path d="M5 13 H19" />
      <Path d="M5 17 H19" />
    </>
  ),
  rain: () => (
    <>
      <Path d="M6 11 Q12 6 18 11" />
      <Path d="M8 14 L7 18" />
      <Path d="M12 14 L11 18" />
      <Path d="M16 14 L15 18" />
    </>
  ),
  storm: () => (
    <>
      <Path d="M6 11 Q12 6 18 11" />
      <Path d="M12 11 L9 16 H12 L10 20" />
    </>
  ),
  clear: () => (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M5 5 L6.5 6.5 M17.5 17.5 L19 19 M19 5 L17.5 6.5 M6.5 17.5 L5 19" />
    </>
  ),
  spy: () => (
    <>
      <Path d="M3 12 Q12 5 21 12 Q12 19 3 12 Z" />
      <Circle cx={12} cy={12} r={2.2} />
    </>
  ),
  medic: () => (
    <>
      <Path d="M12 6 V18" />
      <Path d="M6 12 H18" />
    </>
  ),
  muster: () => (
    <>
      <Circle cx={7} cy={11} r={2.1} />
      <Circle cx={17} cy={11} r={2.1} />
      <Circle cx={12} cy={14} r={2.5} />
    </>
  ),
  bond: () => (
    <>
      <Rect x={5} y={9} width={9} height={6} rx={3} />
      <Rect x={10} y={9} width={9} height={6} rx={3} />
    </>
  ),
  moral: () => (
    <>
      <Path d="M8 3 V21" />
      <Path d="M8 4 H18 L15 7.5 L18 11 H8 Z" />
    </>
  ),
  horn: () => (
    <>
      <Path d="M4 14 C 4 9, 9 7, 14 8 C 18 9, 19 12, 18 14 L 15 13 C 14.5 15, 11 15.5, 8 15 C 6 14.7, 4.5 14.5, 4 14 Z" />
      <Circle cx={5.2} cy={13} r={0.9} />
    </>
  ),
  agile: () => (
    <>
      <Path d="M3 12 H21" />
      <Path d="M6 9 L3 12 L6 15" />
      <Path d="M18 9 L21 12 L18 15" />
    </>
  ),
  scorch: (c) => (
    <Path
      {...fill(c)}
      d="M12 2 C 13 6, 16 7, 16 12 C 16 16, 13.5 21, 12 21 C 10.5 21, 8 16, 8 12 C 8 9.5, 9.5 9, 10 6.5 C 10.8 8.5, 11.2 6, 12 2 Z"
    />
  ),
  decoy: () => (
    <>
      <Path d="M4 13 Q8 7 12 13 Q16 7 20 13" />
      <Path d="M4 13 Q8 19 12 13 Q16 19 20 13" />
    </>
  ),
  crown: (c) => <Path {...fill(c)} d="M4 18 L5 8 L9.5 12 L12 6 L14.5 12 L19 8 L20 18 Z" />,
  gem: (c) => <Polygon {...fill(c)} points="6,4 18,4 21,9 12,21 3,9" />,
  grave: () => (
    <>
      <Path d="M7 21 V11 a5 5 0 0 1 10 0 V21 Z" />
      <Path d="M12 8.5 V14 M9.5 11 H14.5" />
    </>
  ),
  hand: () => (
    <>
      <Rect x={9} y={8} width={7} height={11} rx={1.2} transform="rotate(12 12 19)" />
      <Rect x={9} y={8} width={7} height={11} rx={1.2} />
      <Rect x={9} y={8} width={7} height={11} rx={1.2} transform="rotate(-12 12 19)" />
    </>
  ),
  deck: () => (
    <>
      <Rect x={7} y={7} width={10} height={13} rx={1.5} />
      <Path d="M10 7 V5 H20 V16 H17" />
    </>
  ),
  close: () => (
    <>
      <Path d="M6 6 L18 18" />
      <Path d="M18 6 L6 18" />
    </>
  ),
  star: (c) => (
    <Polygon
      {...fill(c)}
      points="12,3 14.5,9.3 21,9.7 16,14 17.7,20.5 12,16.8 6.3,20.5 8,14 3,9.7 9.5,9.3"
    />
  ),
};
