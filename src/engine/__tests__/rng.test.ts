import { describe, expect, it } from 'vitest';
import { rngInt, rngNext, rngPick, rngShuffle, seedToRngState } from '../rng.ts';

describe('rng', () => {
  it('same seed ⇒ same sequence', () => {
    let a = seedToRngState('hello');
    let b = seedToRngState('hello');
    for (let i = 0; i < 50; i++) {
      const [va, na] = rngNext(a);
      const [vb, nb] = rngNext(b);
      expect(va).toBe(vb);
      a = na;
      b = nb;
    }
  });

  it('different seeds ⇒ different sequences', () => {
    const [a] = rngNext(seedToRngState('seed-1'));
    const [b] = rngNext(seedToRngState('seed-2'));
    expect(a).not.toBe(b);
  });

  it('rngInt stays in bounds', () => {
    let s = seedToRngState('bounds');
    for (let i = 0; i < 200; i++) {
      const [v, next] = rngInt(s, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      s = next;
    }
  });

  it('shuffle is a permutation and is deterministic', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const [s1] = rngShuffle(seedToRngState('shuffle'), items);
    const [s2] = rngShuffle(seedToRngState('shuffle'), items);
    expect(s1).toEqual(s2);
    expect([...s1].sort()).toEqual([...items].sort());
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']); // input untouched
  });

  it('pick returns n distinct elements', () => {
    const items = [1, 2, 3, 4, 5];
    const [picked] = rngPick(seedToRngState('pick'), items, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    const [all] = rngPick(seedToRngState('pick'), items, 99);
    expect(all).toHaveLength(5);
  });
});
