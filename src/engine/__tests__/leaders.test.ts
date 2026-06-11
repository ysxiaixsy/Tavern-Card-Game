import { describe, expect, it } from 'vitest';
import { applyMove } from '../apply.ts';
import { getLegalMoves } from '../legal.ts';
import { getView } from '../view.ts';
import { GwentError } from '../types.ts';
import { makeState } from './testkit.ts';

function useLeader(state: ReturnType<typeof makeState>, player: 'p1' | 'p2', targetInstanceId?: string) {
  return applyMove(state, { type: 'USE_LEADER', player, ...(targetInstanceId ? { targetInstanceId } : {}) });
}

describe('Foltest — play an Impenetrable Fog from your deck', () => {
  it('pulls the fog out of the deck into the weather area and consumes the leader', () => {
    const state = makeState({
      p1: { leader: 'nr_foltest', deck: ['nr_ves', 'neu_fog', 'nr_keira'], hand: ['nr_yarpen'] },
      p2: { hand: ['mon_fiend'], rows: { ranged: ['mon_forktail'] } },
    });
    const s = useLeader(state, 'p1');
    expect(s.weatherCards.map((w) => w.defId)).toEqual(['neu_fog']);
    expect(s.weatherCards[0].owner).toBe('p1');
    expect(s.players.p1.deck.map((c) => c.defId)).toEqual(['nr_ves', 'nr_keira']);
    expect(s.players.p1.leaderUsed).toBe(true);
    expect(getView(s, 'p2').you.rows.ranged.total).toBe(1); // forktail fogged to 1
    expect(s.turn).toBe('p2'); // using the leader consumes the turn
    expect(() => useLeader(s, 'p1')).toThrowError(GwentError); // spent (and not p1's turn)
  });

  it('is not offered (and throws) when no fog remains in the deck', () => {
    const state = makeState({
      p1: { leader: 'nr_foltest', deck: ['nr_ves'], hand: ['nr_yarpen'] },
      p2: { hand: ['mon_fiend'] },
    });
    expect(getLegalMoves(state, 'p1').some((m) => m.type === 'USE_LEADER')).toBe(false);
    expect(() => useLeader(state, 'p1')).toThrowError(GwentError);
  });
});

describe('Emhyr — look at 3 random cards in the opponent\'s hand', () => {
  it('reveals up to 3 opponent cards to the caster only', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr', faction: 'nilfgaard', hand: ['nr_ves'] },
      p2: { hand: ['mon_fiend', 'mon_ghoul', 'mon_werewolf', 'mon_griffin'] },
    });
    const s = useLeader(state, 'p1');
    expect(s.players.p1.knownOpponentCardIds).toHaveLength(3);

    const p1View = getView(s, 'p1');
    expect(p1View.opponent.revealedHand).toHaveLength(3);
    // Every revealed card is genuinely in p2's hand.
    const p2HandIds = s.players.p2.hand.map((c) => c.instanceId);
    for (const card of p1View.opponent.revealedHand) {
      expect(p2HandIds).toContain(card.instanceId);
    }
    // The reveal is one-directional: p2's view of p1 is unchanged.
    expect(getView(s, 'p2').opponent.revealedHand).toHaveLength(0);
  });

  it('reveals fewer when the opponent holds fewer than 3', () => {
    const state = makeState({
      p1: { leader: 'ng_emhyr', faction: 'nilfgaard', hand: ['nr_ves'] },
      p2: { hand: ['mon_fiend', 'mon_ghoul'] },
    });
    const s = useLeader(state, 'p1');
    expect(s.players.p1.knownOpponentCardIds).toHaveLength(2);
  });
});

describe('Eredin — restore a unit from your graveyard to your hand', () => {
  it('moves the chosen non-hero unit back to hand', () => {
    const state = makeState({
      p1: { hand: ['nr_ves'] },
      p2: { leader: 'mon_eredin', hand: ['mon_ghoul'], graveyard: ['mon_fiend', 'mon_draug'] },
      turn: 'p2',
    });
    const fiend = state.players.p2.graveyard[0];
    const s = useLeader(state, 'p2', fiend.instanceId);
    expect(s.players.p2.hand.map((c) => c.defId).sort()).toEqual(['mon_fiend', 'mon_ghoul']);
    expect(s.players.p2.graveyard.map((c) => c.defId)).toEqual(['mon_draug']);
  });

  it('cannot restore heroes; offers one move per legal target', () => {
    const state = makeState({
      p1: { hand: ['nr_ves'] },
      p2: { leader: 'mon_eredin', hand: ['mon_ghoul'], graveyard: ['mon_fiend', 'mon_draug'] },
      turn: 'p2',
    });
    const leaderOptions = getLegalMoves(state, 'p2').filter((m) => m.type === 'USE_LEADER');
    expect(leaderOptions).toHaveLength(1); // only the fiend qualifies
    const draug = state.players.p2.graveyard[1];
    expect(() => useLeader(state, 'p2', draug.instanceId)).toThrowError(GwentError);
  });
});

describe('Francesca — extra card at match start (auto)', () => {
  it('is never an on-demand move', () => {
    const state = makeState({
      p1: { leader: 'st_francesca', faction: 'scoiatael', hand: ['nr_ves'] },
      p2: { hand: ['mon_fiend'] },
    });
    expect(getLegalMoves(state, 'p1').some((m) => m.type === 'USE_LEADER')).toBe(false);
    expect(() => useLeader(state, 'p1')).toThrowError(GwentError);
    // The auto-draw itself is covered end-to-end in factions.test.ts.
  });
});
