/**
 * Starter deck lists for v1 (the deck builder arrives in M5).
 *
 * Both decks are legal: 1 leader, ≥ 22 unit cards (heroes count as units),
 * ≤ 10 special cards, and every card is faction-locked or neutral. Between
 * them they exercise every mechanic: spies, medics (incl. a hero medic), a
 * tight-bond trio, moral boost, several muster groups, a horn unit, an agile
 * unit, unit-scorch, all three weathers + clear, horn, scorch and decoy.
 */

import type { DeckList } from '../types.ts';

/** Northern Realms — Foltest. 27 units, 8 specials. */
export const NORTHERN_REALMS_STARTER: DeckList = {
  leaderId: 'nr_foltest',
  cardIds: [
    // Heroes
    'nr_vernon',
    'nr_natalis',
    'nr_esterad',
    'nr_philippa',
    'neu_geralt',
    'neu_yennefer', // hero medic
    // Spies
    'nr_stennis',
    'nr_dijkstra',
    'nr_thaler',
    // Medics
    'nr_dun_banner_medic',
    'nr_dun_banner_medic',
    'nr_dun_banner_medic',
    // Tight bond
    'nr_blue_stripes',
    'nr_blue_stripes',
    'nr_blue_stripes',
    'nr_crinfrid',
    'nr_crinfrid',
    'nr_crinfrid',
    'nr_catapult',
    'nr_catapult',
    // Moral boost
    'nr_kaedweni',
    'nr_kaedweni',
    'nr_kaedweni',
    // Bodies & toolbox
    'nr_siegfried',
    'nr_ves',
    'neu_dandelion', // horn unit
    'neu_villentretenmerth', // unit-scorch
    // Specials (8)
    'neu_horn',
    'neu_horn',
    'neu_decoy',
    'neu_decoy',
    'neu_clear',
    'neu_clear',
    'neu_scorch',
    'neu_fog', // required in-deck for Foltest's leader ability
  ],
};

/** Monsters — Eredin. 29 units, 8 specials. */
export const MONSTERS_STARTER: DeckList = {
  leaderId: 'mon_eredin',
  cardIds: [
    // Heroes
    'mon_draug',
    'mon_imlerith',
    'mon_leshen',
    'mon_kayran',
    'neu_ciri',
    'neu_triss',
    'neu_avallach', // hero spy
    // Muster packages
    'mon_nekker',
    'mon_nekker',
    'mon_nekker',
    'mon_ghoul',
    'mon_ghoul',
    'mon_ghoul',
    'mon_arachas',
    'mon_arachas',
    'mon_arachas',
    'mon_crone_brewess',
    'mon_crone_weavess',
    'mon_crone_whispess',
    'mon_vampire_katakan',
    'mon_vampire_bruxa',
    'mon_vampire_fleder',
    'mon_vampire_garkain',
    // Bodies
    'mon_fiend',
    'mon_werewolf',
    'mon_griffin',
    'mon_celaeno_harpy', // agile
    'mon_earth_elemental',
    'mon_fire_elemental',
    // Specials (8)
    'neu_frost',
    'neu_frost',
    'neu_rain',
    'neu_fog',
    'neu_horn',
    'neu_horn',
    'neu_decoy',
    'neu_scorch',
  ],
};

export const STARTER_DECKS = {
  northern_realms: NORTHERN_REALMS_STARTER,
  monsters: MONSTERS_STARTER,
} as const;
