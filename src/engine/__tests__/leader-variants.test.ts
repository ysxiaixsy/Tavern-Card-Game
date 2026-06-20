import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { validateDeck } from '../game.ts';
import { NORTHERN_REALMS_STARTER } from '../data/decks.ts';
import { rowTotal } from '../strength.ts';
import { GwentError, type Move } from '../types.ts';
import { graveyardDefs, makeState, pass } from './testkit.ts';

function leaderMove(state: ReturnType<typeof makeState>, player: 'p1' | 'p2'): Move | undefined {
  return getLegalMoves(state, player).find((m) => m.type === 'USE_LEADER');
}

describe('weather_from_deck variants', () => {
  it('Pureblood Elf pulls Biting Frost from the deck', () => {
    const state = makeState({
      p1: {
        leader: 'st_francesca_pureblood',
        deck: ['st_toruviel', 'neu_frost'],
        hand: ['st_dennis'],
      },
      p2: { hand: ['mon_fiend'], rows: { melee: ['mon_fiend'] } },
    });
    const move = leaderMove(state, 'p1');
    expect(move).toBeDefined();
    const s = applyMove(state, move as Move);
    expect(s.weatherCards.map((w) => w.defId)).toEqual(['neu_frost']);
    expect(rowTotal(s, 'p2', 'melee')).toBe(1);
    expect(s.players.p1.deck.map((c) => c.defId)).toEqual(['st_toruviel']);
  });

  it('is not offered without the matching weather in the deck', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr_whiteflame', deck: ['neu_frost'], hand: ['ng_cynthia'] }, // frost ≠ rain
      p2: { hand: ['mon_fiend'] },
    });
    expect(leaderMove(state, 'p1')).toBeUndefined();
  });
});

describe('Lord Commander of the North — clear weather', () => {
  it('lifts all weather; spent cards reach their owners\' graveyards', () => {
    const state = makeState({
      p1: { leader: 'nr_foltest_commander', hand: ['nr_ves'], rows: { melee: ['neu_vesemir'] } },
      p2: { hand: ['mon_fiend'] },
      weather: [
        { defId: 'neu_frost', owner: 'p2' },
        { defId: 'neu_rain', owner: 'p1' },
      ],
    });
    expect(rowTotal(state, 'p1', 'melee')).toBe(1);
    const s = applyMove(state, leaderMove(state, 'p1') as Move);
    expect(s.weatherCards).toHaveLength(0);
    expect(rowTotal(s, 'p1', 'melee')).toBe(6);
    expect(graveyardDefs(s, 'p1')).toEqual(['neu_rain']);
    expect(graveyardDefs(s, 'p2')).toEqual(['neu_frost']);
    expect(s.players.p1.leaderUsed).toBe(true);
  });

  it('is not offered under clear skies', () => {
    const state = makeState({
      p1: { leader: 'nr_foltest_commander', hand: ['nr_ves'] },
      p2: { hand: ['mon_fiend'] },
    });
    expect(leaderMove(state, 'p1')).toBeUndefined();
  });
});

describe('scorch_row_leader variants', () => {
  it('Queen of Dol Blathanna burns the strongest non-hero melee unit(s) at 10+', () => {
    const state = makeState({
      p1: { leader: 'st_francesca_queen', hand: ['st_dennis'] },
      p2: { hand: ['mon_ghoul'], rows: { melee: ['mon_fiend', 'mon_werewolf', 'mon_draug'] } }, // 6+5+hero10
    });
    const s = applyMove(state, leaderMove(state, 'p1') as Move);
    expect(s.players.p2.rows.melee.units.map((u) => u.defId).sort()).toEqual([
      'mon_draug',
      'mon_werewolf',
    ]);
    expect(graveyardDefs(s, 'p2')).toEqual(['mon_fiend']);
  });

  it('the Steel-Forged hits the SIEGE row instead', () => {
    const state = makeState({
      p1: { leader: 'nr_foltest_steelforged', hand: ['nr_ves'] },
      p2: {
        hand: ['mon_ghoul'],
        rows: { siege: ['mon_earth_elemental', 'mon_ice_giant'], melee: ['mon_fiend'] }, // siege 11
      },
    });
    const s = applyMove(state, leaderMove(state, 'p1') as Move);
    expect(s.players.p2.rows.siege.units.map((u) => u.defId)).toEqual(['mon_ice_giant']);
    expect(s.players.p2.rows.melee.units).toHaveLength(1); // melee untouched
    expect(graveyardDefs(s, 'p2')).toEqual(['mon_earth_elemental']);
  });

  it('is not offered below the threshold or against hero-only rows', () => {
    const below = makeState({
      p1: { leader: 'st_francesca_queen', hand: ['st_dennis'] },
      p2: { hand: ['mon_ghoul'], rows: { melee: ['mon_werewolf'] } }, // 5 < 10
    });
    expect(leaderMove(below, 'p1')).toBeUndefined();
    const heroesOnly = makeState({
      p1: { leader: 'st_francesca_queen', hand: ['st_dennis'] },
      p2: { hand: ['mon_ghoul'], rows: { melee: ['mon_draug', 'mon_imlerith'] } }, // 20, all heroes
    });
    expect(leaderMove(heroesOnly, 'p1')).toBeUndefined();
  });
});

describe('the Relentless — steal from the enemy graveyard', () => {
  it('moves a chosen non-hero enemy casualty into your hand', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr_relentless', hand: ['ng_cynthia'] },
      p2: { hand: ['mon_fiend'], graveyard: ['nr_stennis', 'mon_draug'] },
    });
    const moves = getLegalMoves(state, 'p1').filter((m) => m.type === 'USE_LEADER');
    expect(moves).toHaveLength(1); // the hero Draug is not stealable
    const s = applyMove(state, moves[0]);
    expect(s.players.p1.hand.map((c) => c.defId).sort()).toEqual(['ng_cynthia', 'nr_stennis']);
    expect(s.players.p2.graveyard.map((c) => c.defId)).toEqual(['mon_draug']);
    expect(s.players.p1.leaderUsed).toBe(true);
  });
});

describe('Destroyer of Worlds — discard 2, fetch 1', () => {
  it('discards two hand cards to the graveyard and fetches the chosen deck card', () => {
    const state = makeState({
      p1: {
        leader: 'mon_eredin_destroyer',
        hand: ['mon_ghoul', 'mon_wyvern', 'mon_fiend'],
        deck: ['mon_draug', 'mon_werewolf'],
      },
      p2: { hand: ['nr_ves'] },
    });
    const moves = getLegalMoves(state, 'p1').filter(
      (m) => m.type === 'USE_LEADER' && m.drawDefId !== undefined,
    );
    // 3 hand pairs × 2 distinct deck defs.
    expect(moves).toHaveLength(6);

    const [ghoul, wyvern] = state.players.p1.hand;
    const move = moves.find(
      (m) =>
        m.type === 'USE_LEADER' &&
        m.drawDefId === 'mon_draug' &&
        m.discardInstanceIds?.includes(ghoul.instanceId) &&
        m.discardInstanceIds?.includes(wyvern.instanceId),
    );
    expect(move).toBeDefined();
    const s = applyMove(state, move as Move);
    expect(s.players.p1.hand.map((c) => c.defId).sort()).toEqual(['mon_draug', 'mon_fiend']);
    expect(graveyardDefs(s, 'p1')).toEqual(['mon_ghoul', 'mon_wyvern']);
    expect(s.players.p1.deck.map((c) => c.defId)).toEqual(['mon_werewolf']);
    expect(s.turn).toBe('p2'); // using the leader consumed the turn
  });

  it('is not offered with fewer than 2 hand cards or an empty deck', () => {
    const thinHand = makeState({
      p1: { leader: 'mon_eredin_destroyer', hand: ['mon_ghoul'], deck: ['mon_fiend'] },
      p2: { hand: ['nr_ves'] },
    });
    expect(leaderMove(thinHand, 'p1')).toBeUndefined();
    const emptyDeck = makeState({
      p1: { leader: 'mon_eredin_destroyer', hand: ['mon_ghoul', 'mon_wyvern'] },
      p2: { hand: ['nr_ves'] },
    });
    expect(leaderMove(emptyDeck, 'p1')).toBeUndefined();
  });
});

describe('row_horn variants — the leader as a Commander\'s Horn', () => {
  it('Red Riders doubles the melee row via a marker in the horn slot', () => {
    const state = makeState({
      p1: { leader: 'mon_eredin_redriders', hand: ['mon_ghoul'], rows: { melee: ['mon_fiend'] } },
      p2: { hand: ['nr_ves'] },
    });
    const s = applyMove(state, leaderMove(state, 'p1') as Move);
    expect(rowTotal(s, 'p1', 'melee')).toBe(12);
    expect(s.players.p1.rows.melee.horn?.defId).toBe('leader_horn_marker');
  });

  it('is blocked while a Commander\'s Horn occupies the row (no stacking)', () => {
    const state = makeState({
      p1: {
        leader: 'st_francesca_beautiful',
        hand: ['st_dennis', 'neu_horn'],
        rows: { ranged: ['st_ida'] },
      },
      p2: { hand: ['nr_ves'] },
    });
    // Horn the ranged row first, then the leader has nothing to offer.
    const hornCard = state.players.p1.hand[1];
    const horned = applyMove(state, {
      type: 'PLAY_CARD',
      player: 'p1',
      cardInstanceId: hornCard.instanceId,
      row: 'ranged',
    });
    expect(leaderMove(horned, 'p1')).toBeUndefined();
  });

  it('the marker evaporates at round end instead of entering a graveyard', () => {
    const state = makeState({
      p1: { leader: 'mon_eredin_redriders', hand: ['mon_ghoul'], rows: { melee: ['mon_fiend'] } },
      p2: { hand: ['nr_ves', 'nr_keira'] },
      turn: 'p1',
    });
    let s = applyMove(state, leaderMove(state, 'p1') as Move);
    s = pass(s, 'p2');
    s = pass(s, 'p1');
    expect(s.round).toBe(2);
    expect(s.players.p1.rows.melee.horn).toBeNull();
    expect(graveyardDefs(s, 'p1')).not.toContain('leader_horn_marker');
    expect(graveyardDefs(s, 'p2')).not.toContain('leader_horn_marker');
  });
});

describe('Emperor of Nilfgaard — cancel the enemy leader', () => {
  it('spends the opponent\'s unused leader ability', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr_emperor', hand: ['ng_cynthia'] },
      p2: { leader: 'mon_eredin', hand: ['mon_fiend'], graveyard: ['mon_werewolf'] },
    });
    // Before: the Monsters player could restore a unit.
    expect(
      getLegalMoves({ ...state, turn: 'p2' }, 'p2').some((m) => m.type === 'USE_LEADER'),
    ).toBe(true);
    const s = applyMove(state, leaderMove(state, 'p1') as Move);
    expect(s.players.p2.leaderUsed).toBe(true);
    expect(getLegalMoves(s, 'p2').some((m) => m.type === 'USE_LEADER')).toBe(false);
  });

  it('has no target once the enemy leader is already spent', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr_emperor', hand: ['ng_cynthia'] },
      p2: { leaderUsed: true, hand: ['mon_fiend'] },
    });
    expect(leaderMove(state, 'p1')).toBeUndefined();
    expect(() =>
      applyMove(state, { type: 'USE_LEADER', player: 'p1' }),
    ).toThrowError(GwentError);
  });
});

describe('King of the Wild Hunt — pick any weather from the deck', () => {
  it('offers one move per distinct weather in deck and plays the chosen one', () => {
    const state = makeState({
      p1: {
        leader: 'mon_eredin_king',
        hand: ['mon_ghoul'],
        deck: ['neu_frost', 'mon_fiend', 'neu_rain'],
      },
      p2: { hand: ['nr_ves'] },
    });
    const moves = getLegalMoves(state, 'p1').filter((m) => m.type === 'USE_LEADER');
    expect(moves.map((m) => (m as { drawDefId?: string }).drawDefId).sort()).toEqual([
      'neu_frost',
      'neu_rain',
    ]);
    const s = applyMove(state, moves.find((m) => (m as { drawDefId?: string }).drawDefId === 'neu_rain')!);
    expect(s.weatherCards.map((w) => w.defId)).toEqual(['neu_rain']);
    expect(s.players.p1.leaderUsed).toBe(true);
  });
});

describe('deck building with leader variants', () => {
  it('any same-faction leader variant heads a legal deck', () => {
    for (const leaderId of [
      'nr_foltest_commander',
      'nr_foltest_siegemaster',
      'nr_foltest_steelforged',
    ]) {
      expect(() => validateDeck({ ...NORTHERN_REALMS_STARTER, leaderId })).not.toThrow();
    }
  });

  it('the leader horn marker can never be decked', () => {
    expect(() =>
      validateDeck({
        ...NORTHERN_REALMS_STARTER,
        cardIds: [...NORTHERN_REALMS_STARTER.cardIds, 'leader_horn_marker'],
      }),
    ).toThrowError(GwentError);
  });
});
