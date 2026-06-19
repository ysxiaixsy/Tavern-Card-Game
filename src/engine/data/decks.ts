/**
 * Starter deck lists, one per faction — the immutable templates the deck
 * builder offers for duplication. Every starter is exactly MAX_DECK_CARDS
 * (30) and legal: 1 leader, ≥ 22 unit cards (heroes count), ≤ 10 specials,
 * 25–30 total, every card faction-locked or neutral. Between them they
 * exercise every mechanic: spies, medics (incl. hero medics), tight bonds,
 * moral boost, muster groups, horn units, agile units, unit-scorch, weather.
 */

import type { DeckList } from '../types.ts';

/** Northern Realms — Foltest. 25 units + 5 specials. */
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
    // Specials (5)
    'neu_fog', // required in-deck for Foltest's leader ability
    'neu_horn',
    'neu_decoy',
    'neu_decoy',
    'neu_scorch',
  ],
};

/** Monsters — Eredin. 24 units + 6 specials. */
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
    'mon_celaeno_harpy', // agile
    'mon_earth_elemental',
    'mon_fire_elemental',
    // Specials (6)
    'neu_frost',
    'neu_rain',
    'neu_fog',
    'neu_horn',
    'neu_decoy',
    'neu_scorch',
  ],
};

/** Nilfgaard — Emhyr. 26 units + 4 specials. Spies and ties. */
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
    // Specials (4) — decoys feed the spy loop; rain serves the White Flame
    'neu_decoy',
    'neu_decoy',
    'neu_horn',
    'neu_rain',
  ],
};

/** Scoia'tael — Francesca. 25 units + 5 specials. Agility and ambushes. */
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
    'st_yaevinn',
    'st_dol_scout',
    'st_dol_scout',
    'st_vrihedd_veteran',
    'st_barclay',
    // Bodies
    'st_milva',
    'st_ida',
    'st_dennis',
    'st_mahakaman',
    'st_mahakaman',
    // Specials (5) — frost serves the Pureblood Elf
    'neu_horn',
    'neu_horn',
    'neu_decoy',
    'neu_clear',
    'neu_frost',
  ],
};

/** Skellige — Crach an Craite. 25 units + 5 specials. Resilience + recursion. */
export const SKELLIGE_STARTER: DeckList = {
  leaderId: 'sk_crach',
  cardIds: [
    // Heroes
    'sk_hjalmar',
    'sk_cerys',
    'sk_ermion',
    'neu_geralt',
    // Summon avenger
    'sk_kambi', // → Hemdall next round
    // Medic
    'sk_birna',
    // Tight bond
    'sk_shieldmaiden',
    'sk_shieldmaiden',
    'sk_shieldmaiden',
    'sk_craite_warrior',
    'sk_craite_warrior',
    'sk_craite_warrior',
    'sk_war_longship',
    'sk_war_longship',
    // Muster
    'sk_light_longship',
    'sk_light_longship',
    'sk_light_longship',
    // Bodies
    'sk_skald',
    'sk_brokvar',
    'sk_dimun',
    'sk_armorsmith',
    'sk_donar',
    'sk_holger',
    'sk_madman_lugos',
    'sk_vabjorn',
    // Specials (5) — Skellige Storm is the faction's signature weather
    'neu_horn',
    'neu_decoy',
    'neu_scorch',
    'neu_frost',
    'sk_storm',
  ],
};

export const STARTER_DECKS = {
  northern_realms: NORTHERN_REALMS_STARTER,
  nilfgaard: NILFGAARD_STARTER,
  monsters: MONSTERS_STARTER,
  scoiatael: SCOIATAEL_STARTER,
  skellige: SKELLIGE_STARTER,
} as const;
