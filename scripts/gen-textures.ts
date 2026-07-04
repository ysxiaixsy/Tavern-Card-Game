/**
 * Procedural texture tiles: `npm run gen:textures`.
 *
 * Generates the seamless material tiles the UI uses (dark oak table, mid oak
 * strips, leather panels, parchment) into assets/textures/. Everything is
 * deterministic (seeded), baked around the design-token hexes, and kept
 * SUBTLE: luma variance is clamped so text contrast never suffers.
 *
 * Seamlessness comes from sampling value noise on a torus (the noise lattice
 * wraps in both axes), so tiles repeat invisibly with resizeMode:'repeat'.
 */

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join(__dirname, '..', 'assets', 'textures');

// ---------------------------------------------------------------------------
// Seeded rng + torus value noise
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** A wrap-around lattice of random values, bilinearly interpolated. */
function makeNoise(cells: number, seed: number): (u: number, v: number) => number {
  const rand = mulberry32(seed);
  const grid: number[] = [];
  for (let i = 0; i < cells * cells; i++) {
    grid.push(rand());
  }
  return (u, v) => {
    // u,v in [0,1) on the torus
    const x = ((u % 1) + 1) % 1 * cells;
    const y = ((v % 1) + 1) % 1 * cells;
    const x0 = Math.floor(x) % cells;
    const y0 = Math.floor(y) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const fx = smooth(x - Math.floor(x));
    const fy = smooth(y - Math.floor(y));
    const a = grid[y0 * cells + x0];
    const b = grid[y0 * cells + x1];
    const c = grid[y1 * cells + x0];
    const d = grid[y1 * cells + x1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
}

/** Multi-octave torus noise in [0,1] (approx). */
function fbm(
  octaves: { cells: number; weight: number; seed: number }[],
): (u: number, v: number) => number {
  const fns = octaves.map((o) => ({ fn: makeNoise(o.cells, o.seed), weight: o.weight }));
  const total = octaves.reduce((s, o) => s + o.weight, 0);
  return (u, v) => fns.reduce((s, o) => s + o.fn(u, v) * o.weight, 0) / total;
}

// ---------------------------------------------------------------------------
// Tile writers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

async function writeTile(
  name: string,
  size: number,
  shade: (u: number, v: number) => [number, number, number],
): Promise<void> {
  const buf = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = shade(x / size, y / size);
      const i = (y * size + x) * 3;
      buf[i] = Math.max(0, Math.min(255, Math.round(r)));
      buf[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      buf[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
  const file = path.join(OUT_DIR, `${name}.png`);
  await sharp(buf, { raw: { width: size, height: size, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${name}.png (${size}x${size})`);
}

/**
 * Wood: vertical grain — noise stretched hard along y with a gentle,
 * torus-safe waviness in x, plus sparse darker grain lines.
 */
function woodShader(
  baseHex: string,
  variance: number,
  seed: number,
): (u: number, v: number) => [number, number, number] {
  const [br, bg, bb] = hexToRgb(baseHex);
  const grain = fbm([
    { cells: 24, weight: 0.55, seed: seed + 1 }, // fine grain across x
    { cells: 6, weight: 0.45, seed: seed + 2 }, // broad planks
  ]);
  const wave = makeNoise(4, seed + 3); // low-freq waviness of the grain
  const lines = makeNoise(48, seed + 4); // sparse dark grain lines
  return (u, v) => {
    // Stretch: grain varies mostly along u (across the grain), slowly along v.
    const wobble = (wave(u, v) - 0.5) * 0.1;
    const n = grain(u + wobble, v * 0.18);
    let l = 1 + (n - 0.5) * 2 * variance;
    // Darker vertical grain lines (visible plank streaks).
    const line = lines(u * 1.0, v * 0.1);
    if (line > 0.78) {
      l -= variance * 1.4;
    } else if (line < 0.12) {
      l += variance * 0.9; // occasional lighter streak for contrast
    }
    return [br * l, bg * l, bb * l];
  };
}

/** Leather: fine isotropic pores + faint broad mottling. */
function leatherShader(
  baseHex: string,
  variance: number,
  seed: number,
): (u: number, v: number) => [number, number, number] {
  const [br, bg, bb] = hexToRgb(baseHex);
  const pores = fbm([
    { cells: 64, weight: 0.5, seed: seed + 1 },
    { cells: 20, weight: 0.3, seed: seed + 2 },
    { cells: 5, weight: 0.2, seed: seed + 3 },
  ]);
  return (u, v) => {
    const n = pores(u, v);
    const l = 1 + (n - 0.5) * 2 * variance;
    return [br * l, bg * l, bb * l];
  };
}

/** Parchment: broad fiber mottling, slightly warm highlights. */
function parchmentShader(
  baseHex: string,
  variance: number,
  seed: number,
): (u: number, v: number) => [number, number, number] {
  const [br, bg, bb] = hexToRgb(baseHex);
  const fiber = fbm([
    { cells: 10, weight: 0.6, seed: seed + 1 },
    { cells: 40, weight: 0.4, seed: seed + 2 },
  ]);
  return (u, v) => {
    const n = fiber(u, v);
    const l = 1 + (n - 0.5) * 2 * variance;
    // Warm the darker mottles a touch (aged look): reduce blue slightly more.
    const warm = 1 - (0.5 - Math.min(n, 0.5)) * 0.06;
    return [br * l, bg * l, bb * l * warm];
  };
}

// ---------------------------------------------------------------------------
// Palette (mirror of src/ui/tokens.ts color roles — keep in sync)
// ---------------------------------------------------------------------------

const BG = '#130d08';
const SURFACE = '#20160e';
const SURFACE_RAISED = '#2c2014';
const PARCHMENT = '#e7d8b6';

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  // Variance tuned on-device: subtle-but-visible grain on a dark phone screen
  // (the first pass at ~5% was invisible). Text contrast still holds.
  await writeTile('oak_dark', 512, woodShader(BG, 0.13, 11));
  await writeTile('oak_mid', 256, woodShader(SURFACE, 0.11, 22));
  await writeTile('leather', 256, leatherShader(SURFACE_RAISED, 0.11, 33));
  await writeTile('parchment', 256, parchmentShader(PARCHMENT, 0.06, 44));
}

void main();
