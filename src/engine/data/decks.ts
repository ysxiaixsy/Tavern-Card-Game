/**
 * Starter deck lists, one per faction (the deck builder arrives in M5).
 *
 * Every deck is legal: 1 leader, ≥ 22 unit cards (heroes count as units),
 * ≤ 10 special cards, and every card is faction-locked or neutral. Between
 * them they exercise every mechanic: spies, medics (incl. hero medics), tight
 * bonds, moral boost, muster groups, horn units, agile units, unit-scorch,
 * all three weathers + clear, horn, scorch and decoy.
 */

import type { DeckList } from '../types.ts';

/** Northern Realms — Foltest. 25 units, 8 specials. */
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
    // Medic (single copy in W3)
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

/** Monsters — Eredin. 30 units, 8 specials. */
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
    'mon_arachas_behemoth',
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

/** Nilfgaard — Emhyr. 26 units, 8 specials. Spies and ties. */
export const NILFGAARD_STARTER: DeckList = {
  leaderId: 'ng_emhyr',
  cardIds: [
    // Heroes
    'ng_letho',
    'ng_menno', // hero medic
    'ng_morvran',
    'ng_tibor',
    // Spies — the faction's engine
    'ng_skellen',
    'ng_shilard',
    'ng_vattier',
    // Medics
    'ng_etolian_archers',
    'ng_etolian_archers',
    // Tight bond
    'ng_impera',
    'ng_impera',
    'ng_impera',
    'ng_nausicaa',
    'ng_nausicaa',
    'ng_nausicaa',
    'ng_emissary',
    'ng_emissary',
    // Bodies
    'ng_arbalest',
    'ng_arbalest',
    'ng_cahir',
    'ng_assire',
    'ng_fringilla',
    'ng_renuald',
    'ng_heavy_scorpion',
    'ng_scorpion',
    'ng_siege_engineer',
    // Specials (8) — decoys feed the spy loop
    'neu_decoy',
    'neu_decoy',
    'neu_decoy',
    'neu_horn',
    'neu_horn',
    'neu_clear',
    'neu_fog',
    'neu_rain',
  ],
};

/** Scoia'tael — Francesca. 27 units, 8 specials. Agility and ambushes. */
export const SCOIATAEL_STARTER: DeckList = {
  leaderId: 'st_francesca',
  cardIds: [
    // Heroes
    'st_eithne',
    'st_saesenthessis',
    'st_isengrim', // hero with moral boost
    'st_filavandrel',
    // Muster packages
    'st_elven_skirmisher',
    'st_elven_skirmisher',
    'st_elven_skirmisher',
    'st_dwarven_skirmisher',
    'st_dwarven_skirmisher',
    'st_dwarven_skirmisher',
    'st_havekar_smuggler',
    'st_havekar_smuggler',
    'st_havekar_smuggler',
    // Medics
    'st_havekar_healer',
    'st_havekar_healer',
    // Agile corps
    'st_ciaran',
    'st_yaevinn',
    'st_dol_scout',
    'st_dol_scout',
    'st_vrihedd_veteran',
    'st_barclay',
    // Bodies & toolbox
    'st_milva',
    'st_ida',
    'st_dennis',
    'st_toruviel',
    'st_mahakaman',
    'st_mahakaman',
    // Specials (8)
    'neu_horn',
    'neu_horn',
    'neu_decoy',
    'neu_decoy',
    'neu_clear',
    'neu_clear',
    'neu_frost',
    'neu_scorch',
  ],
};

export const STARTER_DECKS = {
  northern_realms: NORTHERN_REALMS_STARTER,
  nilfgaard: NILFGAARD_STARTER,
  monsters: MONSTERS_STARTER,
  scoiatael: SCOIATAEL_STARTER,
} as const;
