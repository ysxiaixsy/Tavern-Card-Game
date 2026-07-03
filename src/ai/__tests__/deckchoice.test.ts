import { describe, expect, it } from 'vitest';
import { validateDeck } from '../../engine/game.ts';
import { STARTER_DECKS } from '../../engine/data/decks.ts';
import { getCardDef } from '../../engine/data/cards.ts';
import type { Difficulty } from '../agent.ts';
import {
  BUILD_FACTIONS,
  buildAiDeck,
  deckStrength,
  pickAiDeck,
  type DeckOption,
} from '../deckchoice.ts';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'witcher'];

const starterOptions: DeckOption[] = BUILD_FACTIONS.map((faction) => ({
  id: `starter_${faction}`,
  faction,
  leaderId: STARTER_DECKS[faction].leaderId,
  cardIds: [...STARTER_DECKS[faction].cardIds],
}));

describe('buildAiDeck', () => {
  it('drafts a legal deck for every faction at every difficulty', () => {
    for (const faction of BUILD_FACTIONS) {
      for (const difficulty of DIFFICULTIES) {
        const deck = buildAiDeck(faction, difficulty, `t-${faction}-${difficulty}`);
        expect(() => validateDeck(deck)).not.toThrow();
        expect(getCardDef(deck.leaderId).faction).toBe(faction);
        for (const id of deck.cardIds) {
          const def = getCardDef(id);
          expect(def.faction === faction || def.faction === 'neutral').toBe(true);
        }
      }
    }
  });

  it('is deterministic per seed', () => {
    const a = buildAiDeck('skellige', 'normal', 'seed-1');
    const b = buildAiDeck('skellige', 'normal', 'seed-1');
    expect(a).toEqual(b);
  });

  it('surprise picks a valid faction deterministically', () => {
    const a = buildAiDeck('surprise', 'witcher', 'seed-2');
    const b = buildAiDeck('surprise', 'witcher', 'seed-2');
    expect(a).toEqual(b);
    expect(() => validateDeck(a)).not.toThrow();
  });

  it('hard drafts are at least as strong as easy drafts of the same faction', () => {
    // Averaged over seeds: noise-free drafting can't be weaker than noisy.
    let hard = 0;
    let easy = 0;
    for (let i = 0; i < 5; i++) {
      hard += deckStrength(buildAiDeck('nilfgaard', 'hard', `s${i}`) as never);
      easy += deckStrength(buildAiDeck('nilfgaard', 'easy', `s${i}`) as never);
    }
    expect(hard).toBeGreaterThanOrEqual(easy);
  });
});

describe('pickAiDeck', () => {
  it('returns a deck from the pool, deterministically per seed', () => {
    for (const difficulty of DIFFICULTIES) {
      const a = pickAiDeck(starterOptions, difficulty, 'pick-1');
      const b = pickAiDeck(starterOptions, difficulty, 'pick-1');
      expect(a).toBe(b);
      expect(starterOptions).toContain(a);
    }
  });

  it('hard/witcher always take the strongest deck of the rolled faction', () => {
    // Add a deliberately weak custom deck in every faction; the strong pick
    // must never be it.
    const weak: DeckOption[] = starterOptions.map((d) => ({
      ...d,
      id: `${d.id}-weak`,
      cardIds: d.cardIds.slice(0, 25), // fewer cards → strictly weaker sum
    }));
    const pool = [...starterOptions, ...weak];
    for (let i = 0; i < 10; i++) {
      const picked = pickAiDeck(pool, 'witcher', `w-${i}`);
      const rivals = pool.filter((d) => d.faction === picked.faction);
      const best = Math.max(...rivals.map((d) => deckStrength(d)));
      expect(deckStrength(picked)).toBe(best);
    }
  });
});
