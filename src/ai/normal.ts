/**
 * The Normal-difficulty policy: full heuristics over a PlayerView.
 *
 * The agent NEVER sees a GameState — every signal here derives from public
 * information plus its own hand (exactly what a human player knows). Core
 * ideas, per the brief:
 *   - card economy first: the match is won with 2 of 3 rounds on 10 cards,
 *     not by maximizing points; concede lost rounds cheaply
 *   - spies above everything early; muster enablers next; mid-value bodies
 *     as the round currency; heroes/scorch/medics held for contested rounds
 *   - pass when (a) opponent passed and we lead, (b) the deficit is not
 *     worth the cards, (c) we are baiting while holding card advantage
 *   - weather valued as (opponent's row loss − own row loss)
 *
 * Deterministic: same view ⇒ same move (stable scoring, stable tie-break).
 */

import { getCardDef } from '../engine/data/cards.ts';
import { WEATHER_ROW } from '../engine/helpers.ts';
import type {
  CardDef,
  Move,
  MulliganMove,
  PlayCardMove,
  PlayerView,
  RowKind,
  SideView,
  UseLeaderMove,
  WeatherKind,
} from '../engine/types.ts';

export interface ScoredMove {
  move: Move;
  score: number;
}

const ROW_KINDS: readonly RowKind[] = ['melee', 'ranged', 'siege'];

// ---------------------------------------------------------------------------
// Public-information evaluators (shared with Easy/Hard)
// ---------------------------------------------------------------------------

function handDef(view: PlayerView, instanceId: string): CardDef {
  const card = view.you.hand.find((c) => c.instanceId === instanceId);
  if (!card) {
    throw new Error(`ai: ${instanceId} not in hand`);
  }
  return getCardDef(card.defId);
}

function graveyardDef(view: PlayerView, instanceId: string): CardDef | null {
  const card = view.you.graveyard.find((c) => c.instanceId === instanceId);
  return card ? getCardDef(card.defId) : null;
}

/** Strength a row would lose to weather (heroes immune, decoys already 0). */
function rowWeatherLoss(side: SideView, rowKind: RowKind): number {
  let loss = 0;
  for (const unit of side.rows[rowKind].units) {
    if (getCardDef(unit.defId).type === 'unit') {
      loss += Math.max(0, unit.effectiveStrength - 1);
    }
  }
  return loss;
}

/** Margin shift if this weather kind becomes active (0 when already active). */
export function weatherNetGain(view: PlayerView, kind: Exclude<WeatherKind, 'clear'>): number {
  if (view.weather.kinds.includes(kind)) {
    return 0;
  }
  const row = WEATHER_ROW[kind];
  return rowWeatherLoss(view.opponent, row) - rowWeatherLoss(view.you, row);
}

/** Margin shift from lifting all active weather (my recovery − theirs). */
export function clearWeatherNetGain(view: PlayerView): number {
  let mine = 0;
  let theirs = 0;
  for (const kind of view.weather.kinds) {
    const row = WEATHER_ROW[kind];
    for (const unit of view.you.rows[row].units) {
      const def = getCardDef(unit.defId);
      if (def.type === 'unit') {
        mine += Math.max(0, (def.strength ?? 0) - unit.effectiveStrength);
      }
    }
    for (const unit of view.opponent.rows[row].units) {
      const def = getCardDef(unit.defId);
      if (def.type === 'unit') {
        theirs += Math.max(0, (def.strength ?? 0) - unit.effectiveStrength);
      }
    }
  }
  return mine - theirs;
}

/** Margin shift of a global Scorch right now (opponent losses − own losses). */
export function scorchNetGain(view: PlayerView): number {
  let highest = -1;
  for (const side of [view.you, view.opponent]) {
    for (const rowKind of ROW_KINDS) {
      for (const unit of side.rows[rowKind].units) {
        if (getCardDef(unit.defId).type === 'unit' && unit.effectiveStrength > highest) {
          highest = unit.effectiveStrength;
        }
      }
    }
  }
  if (highest < 0) {
    return 0;
  }
  const sumAt = (side: SideView): number => {
    let sum = 0;
    for (const rowKind of ROW_KINDS) {
      for (const unit of side.rows[rowKind].units) {
        if (getCardDef(unit.defId).type === 'unit' && unit.effectiveStrength === highest) {
          sum += unit.effectiveStrength;
        }
      }
    }
    return sum;
  };
  return sumAt(view.opponent) - sumAt(view.you);
}

/** Points gained by horning one of MY rows (0 if a horn effect already applies). */
export function hornGain(view: PlayerView, rowKind: RowKind): number {
  const row = view.you.rows[rowKind];
  if (row.horn !== null) {
    return 0;
  }
  let gain = 0;
  for (const unit of row.units) {
    const def = getCardDef(unit.defId);
    if (def.abilities.includes('horn')) {
      return 0; // Dandelion already doubles this row
    }
    if (def.type === 'unit') {
      gain += unit.effectiveStrength;
    }
  }
  return gain;
}

/** Row-scorch value: strength it would burn off the given enemy row (10+ rule). */
export function rowScorchGain(view: PlayerView, rowKind: RowKind): number {
  const row = view.opponent.rows[rowKind];
  if (row.total < 10) {
    return 0;
  }
  let highest = -1;
  for (const unit of row.units) {
    if (getCardDef(unit.defId).type === 'unit' && unit.effectiveStrength > highest) {
      highest = unit.effectiveStrength;
    }
  }
  if (highest < 0) {
    return 0;
  }
  return row.units
    .filter((u) => getCardDef(u.defId).type === 'unit' && u.effectiveStrength === highest)
    .reduce((sum, u) => sum + u.effectiveStrength, 0);
}

/** Rough margin shift of a move — used for "can we still win this round?" math. */
export function estimateGain(view: PlayerView, move: Move): number {
  if (move.type !== 'PLAY_CARD' && move.type !== 'USE_LEADER') {
    return 0;
  }
  if (move.type === 'USE_LEADER') {
    const leader = getCardDef(view.you.leader.defId);
    switch (leader.leaderAbility) {
      case 'weather_from_deck':
        return leader.leaderWeather ? weatherNetGain(view, leader.leaderWeather) : 0;
      case 'clear_weather':
        return clearWeatherNetGain(view);
      case 'scorch_row_leader':
        return leader.leaderScorchRow ? rowScorchGain(view, leader.leaderScorchRow) : 0;
      case 'row_horn':
        return leader.leaderHornRow ? hornGain(view, leader.leaderHornRow) : 0;
      case 'play_from_graveyard': {
        const def = move.targetInstanceId ? graveyardDef(view, move.targetInstanceId) : null;
        return def && !def.abilities.includes('spy') ? (def.strength ?? 0) : 0;
      }
      default:
        return 0;
    }
  }
  const def = handDef(view, move.cardInstanceId);
  switch (def.type) {
    case 'unit':
    case 'hero': {
      const printed = def.strength ?? 0;
      if (def.abilities.includes('spy')) {
        return -printed; // strengthens THEIR side
      }
      const rowKind = (move.row ?? def.row) as RowKind;
      const weathered = view.weather.kinds.some((k) => WEATHER_ROW[k] === rowKind);
      if (weathered && def.type === 'unit') {
        return 1;
      }
      if (def.abilities.includes('bond')) {
        const onRow = view.you.rows[rowKind].units.filter((u) => u.defId === def.id).length;
        return printed * (onRow + 1) * (onRow + 1) - printed * onRow * onRow;
      }
      return printed;
    }
    case 'weather':
      return def.weather === 'clear' ? clearWeatherNetGain(view) : weatherNetGain(view, def.weather as Exclude<WeatherKind, 'clear'>);
    case 'horn':
      return move.row ? hornGain(view, move.row) : 0;
    case 'scorch':
      return scorchNetGain(view);
    case 'decoy': {
      const target = ROW_KINDS.flatMap((r) => view.you.rows[r].units).find(
        (u) => u.instanceId === move.targetInstanceId,
      );
      return target ? -target.effectiveStrength : 0;
    }
    default:
      return 0;
  }
}

/** How precious a card is — conceding burns cheap cards, never these. */
function cardWorth(def: CardDef): number {
  if (def.abilities.includes('spy')) {
    return 90;
  }
  if (def.type === 'hero') {
    return 50 + (def.strength ?? 0);
  }
  if (def.abilities.includes('medic')) {
    return 45;
  }
  if (def.type === 'scorch' || def.type === 'decoy') {
    return 35;
  }
  if (def.abilities.includes('muster')) {
    return 25;
  }
  return def.strength ?? 5;
}

// ---------------------------------------------------------------------------
// Mulligan
// ---------------------------------------------------------------------------

/**
 * Swap duplicate weather kinds and feeble vanilla bodies (≤2 strength, no
 * abilities). Never swaps spies, medics, heroes, specials, muster or bond
 * pieces — those are the engine of the deck.
 */
export function chooseMulligan(view: PlayerView): Move {
  const seenWeather = new Set<string>();
  const swaps: string[] = [];
  for (const card of view.you.hand) {
    if (swaps.length >= 2) {
      break;
    }
    const def = getCardDef(card.defId);
    if (def.type === 'weather' && def.weather && def.weather !== 'clear') {
      if (seenWeather.has(def.weather)) {
        swaps.push(card.instanceId);
      } else {
        seenWeather.add(def.weather);
      }
    }
  }
  for (const card of view.you.hand) {
    if (swaps.length >= 2) {
      break;
    }
    const def = getCardDef(card.defId);
    if (def.type === 'unit' && (def.strength ?? 0) <= 2 && def.abilities.length === 0) {
      swaps.push(card.instanceId);
    }
  }
  const want = new Set(swaps);
  const match = view.legalMoves.find(
    (m): m is MulliganMove =>
      m.type === 'MULLIGAN' &&
      m.cardInstanceIds.length === want.size &&
      m.cardInstanceIds.every((id) => want.has(id)),
  );
  return match ?? view.legalMoves[0];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score every legal move; highest wins. Exported so Hard can rank candidates.
 * Returned sorted descending, with a stable JSON tie-break for determinism.
 */
export function scoreMoves(view: PlayerView): ScoredMove[] {
  const margin = view.you.total - view.opponent.total;
  const oppPassed = view.opponent.passed;
  const handAdv = view.you.hand.length - view.opponent.handCount;
  const mustWin = view.you.gems <= 1;
  const committed = ROW_KINDS.reduce((n, r) => n + view.you.rows[r].units.length, 0);
  const oppCommitted = ROW_KINDS.reduce((n, r) => n + view.opponent.rows[r].units.length, 0);
  const round = view.round;

  // Pre-compute the comeback picture when the opponent has locked their total.
  let bestSingleGain = 0;
  let totalAvailableGain = 0;
  if (oppPassed) {
    for (const move of view.legalMoves) {
      const gain = estimateGain(view, move);
      if (gain > bestSingleGain) {
        bestSingleGain = gain;
      }
      if (gain > 0) {
        totalAvailableGain += gain;
      }
    }
  }
  const roundWinnable = !oppPassed || margin > 0 || margin + totalAvailableGain > 0;
  /**
   * Abandoning an ACTIVE round: the deficit is no longer worth cards. Each
   * card played here would be matched by the opponent — bank the hand, give
   * the gem, fight the next round with superior resources. (Never while a
   * loss would end the match.)
   */
  const abandoning =
    !oppPassed &&
    !mustWin &&
    ((round === 1 && margin < -18 && oppCommitted >= 4) || margin < -28);
  /** Conceding: round is lost (or not worth it) — dump spies, then pass. */
  const conceding =
    abandoning ||
    (oppPassed &&
      margin <= 0 &&
      (!roundWinnable ||
        (!mustWin &&
          // a comeback would take several precious cards — cut the losses
          margin + bestSingleGain <= 0 &&
          -margin > totalAvailableGain * 0.6)));

  const scored: ScoredMove[] = view.legalMoves.map((move) => ({
    move,
    score: scoreOne(move),
  }));

  scored.sort(
    (a, b) => b.score - a.score || JSON.stringify(a.move).localeCompare(JSON.stringify(b.move)),
  );
  return scored;

  function scoreOne(move: Move): number {
    switch (move.type) {
      case 'MULLIGAN':
        return 0; // handled by chooseMulligan
      case 'CHOOSE_FIRST_PLAYER':
        // Going second lets us react; send the opponent in first.
        return move.first === view.player ? 0 : 10;
      case 'RESOLVE_MEDIC': {
        const def = graveyardDef(view, move.targetInstanceId);
        if (!def) {
          return 0;
        }
        // Brief's revive priority: spy > scorch-bait > biggest unit. We read
        // "scorch-bait" as another medic (the chain extends value) — noted.
        if (def.abilities.includes('spy')) {
          return 1000;
        }
        if (def.abilities.includes('medic')) {
          return 800;
        }
        return 100 + (def.strength ?? 0);
      }
      case 'PASS':
        return passScore();
      case 'USE_LEADER':
        return leaderScore(move);
      case 'PLAY_CARD':
        return playScore(move);
      default:
        return -1;
    }
  }

  function passScore(): number {
    if (oppPassed) {
      if (margin > 0) {
        return 1000; // round is locked: take it
      }
      if (!roundWinnable) {
        return 950; // literally cannot win — stop bleeding (spies still outrank)
      }
      if (conceding) {
        return 600;
      }
      return -100; // fight on
    }
    // Opponent still active.
    if (abandoning) {
      return 70; // stop the bleeding (spies still outrank: dump them first)
    }
    if (margin > 14 && round >= 2 && committed >= 3) {
      return 40; // comfortably ahead late: stop feeding the round
    }
    if (margin > 0 && handAdv >= 2 && round === 1 && committed >= 2) {
      return 30; // ahead on cards AND points: tempt them to overcommit
    }
    return -50;
  }

  function leaderScore(move: UseLeaderMove): number {
    const leader = getCardDef(view.you.leader.defId);
    switch (leader.leaderAbility) {
      case 'weather_from_deck': {
        if (!leader.leaderWeather) {
          return 0;
        }
        const gain = weatherNetGain(view, leader.leaderWeather) + 6; // +6: costs no card
        return gain >= 10 ? 60 + gain : 2;
      }
      case 'clear_weather': {
        const gain = clearWeatherNetGain(view) + 6;
        return gain >= 9 ? 60 + gain : 2;
      }
      case 'scorch_row_leader': {
        const gain = leader.leaderScorchRow ? rowScorchGain(view, leader.leaderScorchRow) : 0;
        return gain >= 6 ? 65 + gain : 3;
      }
      case 'row_horn': {
        const gain = leader.leaderHornRow ? hornGain(view, leader.leaderHornRow) : 0;
        return gain >= 10 ? 40 + Math.min(gain, 40) * 0.8 : 2;
      }
      case 'cancel_leader':
        // Denying an unspent enemy leader is worth a quiet early turn.
        return round === 1 ? 22 : 14;
      case 'peek_hand':
        return round >= 2 ? 12 : 6;
      case 'restore_to_hand': {
        const def = move.targetInstanceId ? graveyardDef(view, move.targetInstanceId) : null;
        if (!def) {
          return 0;
        }
        if (def.abilities.includes('spy')) {
          return 170;
        }
        return (def.strength ?? 0) >= 8 ? 45 : 14;
      }
      case 'play_from_graveyard': {
        const def = move.targetInstanceId ? graveyardDef(view, move.targetInstanceId) : null;
        if (!def) {
          return 0;
        }
        if (def.abilities.includes('spy')) {
          return 180; // instant revive: the spy redraws immediately
        }
        return (def.strength ?? 0) >= 8 ? 55 : 16;
      }
      case 'steal_from_graveyard': {
        const card = view.opponent.graveyard.find((c) => c.instanceId === move.targetInstanceId);
        const def = card ? getCardDef(card.defId) : null;
        if (!def) {
          return 0;
        }
        if (def.abilities.includes('spy')) {
          return 150; // their dead spy becomes OUR spy
        }
        return 12 + (def.strength ?? 0) * 2;
      }
      case 'discard_draw': {
        // Convert two duds into the best card in the deck.
        const fetched = move.drawDefId ? getCardDef(move.drawDefId) : null;
        if (!fetched || !move.discardInstanceIds) {
          return 0;
        }
        let fetchValue = fetched.strength ?? 0;
        if (fetched.abilities.includes('spy')) {
          fetchValue += 25;
        }
        if (fetched.abilities.includes('medic')) {
          fetchValue += 10;
        }
        if (fetched.abilities.includes('muster')) {
          fetchValue += 8;
        }
        let discardCost = 0;
        for (const id of move.discardInstanceIds) {
          const card = view.you.hand.find((c) => c.instanceId === id);
          discardCost += card ? cardWorth(getCardDef(card.defId)) * 0.35 : 99;
        }
        return fetchValue - discardCost - 8;
      }
      default:
        return 0;
    }
  }

  function playScore(move: PlayCardMove): number {
    const def = handDef(view, move.cardInstanceId);
    const gain = estimateGain(view, move);

    // Spies are card economy incarnate — first in almost every situation,
    // and when conceding they outrank even the pass (dump them, THEN pass).
    if (def.abilities.includes('spy')) {
      return conceding || (oppPassed && !roundWinnable) ? 990 : 200 - (def.strength ?? 0);
    }
    // A round being abandoned deserves no further cards.
    if (abandoning) {
      return def.abilities.includes('medic') && bestReviveIsSpy() ? 960 : -10;
    }

    // Opponent locked & we are behind: cheapest card that flips the round.
    if (oppPassed && margin <= 0) {
      if (conceding || !roundWinnable) {
        return def.abilities.includes('medic') && bestReviveIsSpy() ? 960 : gain * 0.1;
      }
      if (margin + gain > 0) {
        return 700 - cardWorth(def);
      }
      return mustWin ? 100 + gain : gain * 0.4;
    }
    // Opponent locked & we already lead: adding cards only wastes them.
    if (oppPassed && margin > 0) {
      return -20 + gain * 0.05;
    }

    // --- open round, both active ---
    switch (def.type) {
      case 'weather': {
        if (def.weather === 'clear') {
          const g = clearWeatherNetGain(view);
          if (g >= 6) {
            return 75 + g;
          }
          return margin < 0 && g >= 3 ? 45 : 4;
        }
        const g = weatherNetGain(view, def.weather as Exclude<WeatherKind, 'clear'>);
        if (g >= 8) {
          return 70 + g;
        }
        return g >= 4 && margin < 0 ? 40 + g : 5;
      }
      case 'scorch': {
        const g = scorchNetGain(view);
        const dampened = round === 1 && g < 12 ? g * 0.5 : g;
        if (dampened >= 8) {
          return 80 + dampened;
        }
        return dampened >= 5 ? 30 : 3;
      }
      case 'horn': {
        const g = move.row ? hornGain(view, move.row) : 0;
        return g >= 10 ? 35 + Math.min(g, 40) * 0.8 : 5;
      }
      case 'decoy': {
        const target = ROW_KINDS.flatMap((r) => view.you.rows[r].units).find(
          (u) => u.instanceId === move.targetInstanceId,
        );
        const targetDef = target ? getCardDef(target.defId) : null;
        if (targetDef?.abilities.includes('spy')) {
          return 190; // steal the planted spy — the classic
        }
        if (targetDef?.abilities.includes('medic')) {
          return round >= 2 ? 28 : 12; // re-use the medic later
        }
        return 1;
      }
      case 'hero': {
        // Hold heroes for contested rounds.
        if (round === 1 && margin > -10) {
          return 8;
        }
        return 26 + (def.strength ?? 0) * 0.5;
      }
      case 'unit': {
        if (def.abilities.includes('scorch_row') && def.scorchRow) {
          const g = rowScorchGain(view, def.scorchRow);
          return g >= 6 ? 60 + g : bodyScore(def) - 2;
        }
        if (def.abilities.includes('medic')) {
          const best = bestReviveValue();
          if (best === 'spy') {
            return 185;
          }
          if (best >= 8 && round >= 2) {
            return 50;
          }
          return round === 1 ? 18 : bodyScore(def);
        }
        if (def.abilities.includes('muster')) {
          const inHand = view.you.hand.filter(
            (c) => getCardDef(c.defId).musterGroup === def.musterGroup,
          ).length;
          return 90 + inHand * 4;
        }
        // Posture: behind → cheapest card that RETAKES the lead beats curve
        // discipline; ahead → drip the smallest body and let THEM spend.
        let score = bodyScore(def) + agileAdjust(move, def);
        if (margin <= 0 && gain > -margin) {
          score += 60 - (def.strength ?? 0); // flip the round, pay minimum
        } else if (margin > 0 && !mustWin) {
          score -= (def.strength ?? 0) * 1.2; // hold the big stuff while leading
        }
        return score;
      }
      default:
        return 0;
    }
  }

  /** Mid-value bodies are the round currency; tiny and huge wait their turn. */
  function bodyScore(def: CardDef): number {
    const printed = def.strength ?? 0;
    // Contested must-win rounds want raw power, not curve discipline.
    let score = mustWin && margin < 0 ? 24 + printed : 30 - Math.abs(printed - 5) * 3;
    if (def.abilities.includes('bond')) {
      const rowKind = def.row as RowKind;
      const onRow =
        rowKind === 'melee' || rowKind === 'ranged' || rowKind === 'siege'
          ? view.you.rows[rowKind].units.filter((u) => u.defId === def.id).length
          : 0;
      const inHand = view.you.hand.filter((c) => c.defId === def.id).length - 1;
      score += onRow * 25 + inHand * 8;
    }
    if (def.abilities.includes('moral')) {
      score += 2;
    }
    // Don't drop bodies into active weather.
    const rowKind = def.row;
    if (rowKind && rowKind !== 'agile' && view.weather.kinds.some((k) => WEATHER_ROW[k] === rowKind)) {
      score -= (def.strength ?? 0) * 2.5;
    }
    return score;
  }

  function agileAdjust(move: PlayCardMove, def: CardDef): number {
    if (def.row !== 'agile' || !move.row) {
      return 0;
    }
    const weathered = view.weather.kinds.some((k) => WEATHER_ROW[k] === move.row);
    return weathered ? -8 : move.row === 'ranged' ? 1 : 0;
  }

  function bestReviveValue(): number | 'spy' {
    let best = 0;
    for (const card of view.you.graveyard) {
      const def = getCardDef(card.defId);
      if (def.type !== 'unit') {
        continue;
      }
      if (def.abilities.includes('spy')) {
        return 'spy';
      }
      best = Math.max(best, def.strength ?? 0);
    }
    return best;
  }

  function bestReviveIsSpy(): boolean {
    return bestReviveValue() === 'spy';
  }
}
