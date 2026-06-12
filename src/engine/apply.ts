/**
 * applyMove — the only way a game advances.
 *
 * Flow for every call:
 *   1. validate the move against the current state (throw GwentError if illegal)
 *   2. clone the state (applyMove is pure; the input is never mutated)
 *   3. mutate the clone: resolve the move and its on-play effects
 *   4. end-of-action flow: hand the turn over / force-pass empty hands /
 *      resolve the round when both players have passed / finish the match
 *
 * Step 4 is skipped while a pendingChoice is open (medic chains): the acting
 * player keeps the turn until the chain is exhausted (see types.ts).
 */

import { getCardDef, LEADER_HORN_MARKER_ID } from './data/cards.ts';
import {
  cloneState,
  drawCards,
  findInRows,
  medicTargets,
  opponentOf,
  PLAYER_IDS,
  ROW_KINDS,
  weatherIndexInDeck,
} from './helpers.ts';
import { rngInt, rngPick, rngShuffle } from './rng.ts';
import { rowTotal, rowUnitViews, sideTotal } from './strength.ts';
import {
  GwentError,
  type CardDef,
  type CardInstance,
  type GameState,
  type Move,
  type MulliganMove,
  type PlayCardMove,
  type PlayerId,
  type ResolveMedicMove,
  type RowKind,
  type UseLeaderMove,
} from './types.ts';

export function applyMove(state: GameState, move: Move): GameState {
  if (state.phase === 'finished') {
    throw new GwentError('GAME_FINISHED', 'the match is over');
  }
  if (move.player !== 'p1' && move.player !== 'p2') {
    throw new GwentError('ILLEGAL_MOVE', `unknown player ${String(move.player)}`);
  }

  // pendingChoice gate: only the owing player may act, and only via the
  // matching resolution move type.
  if (state.pendingChoice) {
    const expected =
      state.pendingChoice.kind === 'medic_revive' ? 'RESOLVE_MEDIC' : 'CHOOSE_FIRST_PLAYER';
    if (move.type !== expected) {
      throw new GwentError('PENDING_CHOICE', `a ${state.pendingChoice.kind} choice must be resolved first`);
    }
    if (move.player !== state.pendingChoice.player) {
      throw new GwentError('NOT_YOUR_TURN', 'this choice belongs to the other player');
    }
  } else if (move.type === 'RESOLVE_MEDIC' || move.type === 'CHOOSE_FIRST_PLAYER') {
    throw new GwentError('ILLEGAL_MOVE', `${move.type} without a matching pending choice`);
  }

  const s = cloneState(state);
  switch (move.type) {
    case 'CHOOSE_FIRST_PLAYER':
      applyChooseFirstPlayer(s, move.first);
      break;
    case 'MULLIGAN':
      applyMulligan(s, move);
      break;
    case 'PASS':
      requirePlayTurn(s, move.player);
      s.players[move.player].passed = true;
      endOfActionFlow(s);
      break;
    case 'PLAY_CARD':
      requirePlayTurn(s, move.player);
      applyPlayCard(s, move);
      endOfActionFlow(s);
      break;
    case 'RESOLVE_MEDIC':
      applyResolveMedic(s, move);
      endOfActionFlow(s);
      break;
    case 'USE_LEADER':
      requirePlayTurn(s, move.player);
      applyUseLeader(s, move);
      endOfActionFlow(s);
      break;
    default:
      throw new GwentError('ILLEGAL_MOVE', `unknown move type ${(move as { type: string }).type}`);
  }
  s.moveCount += 1;
  return s;
}

// ---------------------------------------------------------------------------
// Move handlers
// ---------------------------------------------------------------------------

function requirePlayTurn(s: GameState, player: PlayerId): void {
  if (s.phase !== 'play') {
    throw new GwentError('WRONG_PHASE', `expected play phase, got ${s.phase}`);
  }
  if (s.turn !== player) {
    throw new GwentError('NOT_YOUR_TURN', `it is ${s.turn}'s turn`);
  }
  if (s.players[player].passed) {
    throw new GwentError('ALREADY_PASSED', 'no further actions after passing');
  }
}

function applyChooseFirstPlayer(s: GameState, first: PlayerId): void {
  // Scoia'tael perk: the elf player decides who leads round 1.
  s.roundLeader = first;
  s.turn = first;
  s.pendingChoice = null;
}

function applyMulligan(s: GameState, move: MulliganMove): void {
  if (s.phase !== 'mulligan') {
    throw new GwentError('WRONG_PHASE', 'mulligan is only allowed before round 1');
  }
  const ps = s.players[move.player];
  if (ps.mulliganDone) {
    throw new GwentError('ILLEGAL_MOVE', 'mulligan already submitted');
  }
  const ids = move.cardInstanceIds;
  if (ids.length > 2 || new Set(ids).size !== ids.length) {
    throw new GwentError('ILLEGAL_MOVE', 'mulligan may swap at most 2 distinct cards');
  }

  // Each swap: card returns to the deck, deck is reshuffled, replacement is
  // drawn from the top (the returned card itself can come straight back).
  for (const instanceId of ids) {
    const handIndex = ps.hand.findIndex((c) => c.instanceId === instanceId);
    if (handIndex === -1) {
      throw new GwentError('CARD_NOT_FOUND', `${instanceId} is not in hand`);
    }
    const [returned] = ps.hand.splice(handIndex, 1);
    ps.deck.push(returned);
    const [shuffled, rngState] = rngShuffle(s.rngState, ps.deck);
    ps.deck = shuffled;
    s.rngState = rngState;
    drawCards(s, move.player, 1);
  }

  ps.mulligansUsed = ids.length;
  ps.mulliganDone = true;

  if (PLAYER_IDS.every((p) => s.players[p].mulliganDone)) {
    s.phase = 'play';
    s.round = 1;
    s.turn = s.roundLeader;
    enforceForcedPasses(s); // defensive; hands hold 10–11 cards here
  }
}

function applyPlayCard(s: GameState, move: PlayCardMove): void {
  const ps = s.players[move.player];
  const handIndex = ps.hand.findIndex((c) => c.instanceId === move.cardInstanceId);
  if (handIndex === -1) {
    throw new GwentError('CARD_NOT_FOUND', `${move.cardInstanceId} is not in your hand`);
  }
  const card = ps.hand[handIndex];
  const def = getCardDef(card.defId);

  // Validate BEFORE removing the card from hand so illegal moves are no-ops.
  switch (def.type) {
    case 'unit':
    case 'hero': {
      ps.hand.splice(handIndex, 1);
      resolveUnitPlay(s, move.player, card, def, move.row);
      break;
    }
    case 'weather': {
      ps.hand.splice(handIndex, 1);
      resolveWeatherPlay(s, move.player, card, def);
      break;
    }
    case 'horn': {
      const row = move.row;
      if (!row || !ROW_KINDS.includes(row)) {
        throw new GwentError('ILLEGAL_MOVE', "Commander's Horn needs a target row");
      }
      if (ps.rows[row].horn !== null) {
        throw new GwentError('INVALID_TARGET', `the ${row} horn slot is occupied`);
      }
      ps.hand.splice(handIndex, 1);
      ps.rows[row].horn = card;
      break;
    }
    case 'scorch': {
      ps.hand.splice(handIndex, 1);
      resolveGlobalScorch(s);
      ps.graveyard.push(card);
      break;
    }
    case 'decoy': {
      resolveDecoy(s, move.player, handIndex, move.targetInstanceId);
      break;
    }
    default:
      throw new GwentError('ILLEGAL_MOVE', `cannot play a ${def.type} card from hand`);
  }
}

/**
 * Place a unit/hero and run its on-play effects. Shared by direct plays,
 * medic revivals (full effects: revived spies draw, revived medics chain)
 * and muster pulls (which, in v1 data, have no secondary effects).
 */
function resolveUnitPlay(
  s: GameState,
  actor: PlayerId,
  card: CardInstance,
  def: CardDef,
  rowChoice: RowKind | undefined,
): void {
  const isSpy = def.abilities.includes('spy');
  const side = isSpy ? opponentOf(actor) : actor;

  let rowKind: RowKind;
  if (def.row === 'agile') {
    // Agile: melee or ranged, chosen on every play (incl. Decoy replays).
    if (rowChoice !== 'melee' && rowChoice !== 'ranged') {
      throw new GwentError('ILLEGAL_MOVE', `${def.name} is agile: choose melee or ranged`);
    }
    rowKind = rowChoice;
  } else if (def.row === 'melee' || def.row === 'ranged' || def.row === 'siege') {
    rowKind = def.row;
  } else {
    throw new GwentError('ILLEGAL_MOVE', `${def.name} has no row and cannot be placed`);
  }

  s.players[side].rows[rowKind].units.push(card);

  // Spy: the unit strengthens the OPPONENT's side; you draw 2 from your deck.
  if (isSpy) {
    drawCards(s, actor, 2);
  }

  if (def.abilities.includes('muster') && def.musterGroup) {
    resolveMuster(s, actor, def.musterGroup);
  }

  if (def.abilities.includes('scorch_melee')) {
    resolveRowScorch(s, actor, 'melee');
  }

  // Medic last: it suspends the turn in a pendingChoice. If the graveyard has
  // no legal target the medic resolves as a plain body (auto-skip — skipping
  // is only allowed when there is nothing to revive).
  if (def.abilities.includes('medic') && medicTargets(s.players[actor]).length > 0) {
    s.pendingChoice = { kind: 'medic_revive', player: actor, medicInstanceId: card.instanceId };
  }
}

/**
 * Muster: pull every card sharing the muster group from the actor's hand AND
 * deck onto their printed rows. Pulled cards do not re-trigger on-play
 * effects — every W3 muster group member is a vanilla body, so a recursive
 * resolution could only matter for hypothetical custom cards.
 */
function resolveMuster(s: GameState, actor: PlayerId, group: string): void {
  const ps = s.players[actor];
  const inGroup = (c: CardInstance) => getCardDef(c.defId).musterGroup === group;

  const fromHand = ps.hand.filter(inGroup);
  ps.hand = ps.hand.filter((c) => !inGroup(c));
  const fromDeck = ps.deck.filter(inGroup);
  ps.deck = ps.deck.filter((c) => !inGroup(c));

  for (const pulled of [...fromHand, ...fromDeck]) {
    const def = getCardDef(pulled.defId);
    // All v1 muster units have fixed rows; default a hypothetical agile to melee.
    const rowKind: RowKind =
      def.row === 'melee' || def.row === 'ranged' || def.row === 'siege' ? def.row : 'melee';
    ps.rows[rowKind].units.push(pulled);
  }
}

/** Scorch (special card): kill ALL non-hero units tied for highest strength, both sides. */
function resolveGlobalScorch(s: GameState): void {
  let highest = -1;
  const victims: { side: PlayerId; rowKind: RowKind; instanceId: string }[] = [];
  for (const side of PLAYER_IDS) {
    for (const rowKind of ROW_KINDS) {
      for (const unit of rowUnitViews(s, side, rowKind)) {
        if (getCardDef(unit.defId).type !== 'unit') {
          continue; // heroes immune; decoys are not units
        }
        if (unit.effectiveStrength > highest) {
          highest = unit.effectiveStrength;
          victims.length = 0;
        }
        if (unit.effectiveStrength === highest) {
          victims.push({ side, rowKind, instanceId: unit.instanceId });
        }
      }
    }
  }
  destroyUnits(s, victims);
}

/**
 * Row scorch: if the opponent's given row totals 10 or more (heroes count
 * toward the total), destroy its strongest non-hero unit(s). Used by the
 * Villentretenmerth unit ability (melee) and scorch_row_leader abilities.
 */
function resolveRowScorch(s: GameState, actor: PlayerId, rowKind: RowKind): void {
  const side = opponentOf(actor);
  if (rowTotal(s, side, rowKind) < 10) {
    return;
  }
  let highest = -1;
  const victims: { side: PlayerId; rowKind: RowKind; instanceId: string }[] = [];
  for (const unit of rowUnitViews(s, side, rowKind)) {
    if (getCardDef(unit.defId).type !== 'unit') {
      continue;
    }
    if (unit.effectiveStrength > highest) {
      highest = unit.effectiveStrength;
      victims.length = 0;
    }
    if (unit.effectiveStrength === highest) {
      victims.push({ side, rowKind, instanceId: unit.instanceId });
    }
  }
  destroyUnits(s, victims);
}

/** Remove units from the board into the graveyard of the side they were on. */
function destroyUnits(
  s: GameState,
  victims: { side: PlayerId; rowKind: RowKind; instanceId: string }[],
): void {
  for (const victim of victims) {
    const row = s.players[victim.side].rows[victim.rowKind];
    const index = row.units.findIndex((u) => u.instanceId === victim.instanceId);
    if (index !== -1) {
      const [dead] = row.units.splice(index, 1);
      s.players[victim.side].graveyard.push(dead);
    }
  }
}

/** All weather lifts; the spent cards return to their owners' graveyards. */
function clearAllWeather(s: GameState): void {
  for (const wc of s.weatherCards) {
    s.players[wc.owner].graveyard.push({ instanceId: wc.instanceId, defId: wc.defId });
  }
  s.weatherCards = [];
}

function resolveWeatherPlay(s: GameState, actor: PlayerId, card: CardInstance, def: CardDef): void {
  if (def.weather === 'clear') {
    clearAllWeather(s);
    s.players[actor].graveyard.push(card);
    return;
  }
  // Duplicate weather is legal and has no additional effect; the extra card
  // still sits in the weather area until cleared.
  s.weatherCards.push({ ...card, owner: actor });
}

function resolveDecoy(
  s: GameState,
  actor: PlayerId,
  decoyHandIndex: number,
  targetInstanceId: string | undefined,
): void {
  if (!targetInstanceId) {
    throw new GwentError('ILLEGAL_MOVE', 'Decoy needs a target unit on your side');
  }
  const ps = s.players[actor];
  const location = findInRows(ps, targetInstanceId);
  if (!location) {
    throw new GwentError('INVALID_TARGET', `${targetInstanceId} is not on your side of the board`);
  }
  const target = ps.rows[location.rowKind].units[location.index];
  if (getCardDef(target.defId).type !== 'unit') {
    throw new GwentError('INVALID_TARGET', 'Decoy cannot target heroes or special cards');
  }
  // Swap in place: the decoy takes the unit's exact spot at 0 strength, the
  // unit returns to the actor's hand — enemy spies picked up this way become
  // yours to replay (and re-draw from).
  const [decoy] = ps.hand.splice(decoyHandIndex, 1);
  ps.rows[location.rowKind].units[location.index] = decoy;
  ps.hand.push(target);
}

function applyResolveMedic(s: GameState, move: ResolveMedicMove): void {
  // pendingChoice kind/owner already validated in applyMove.
  const ps = s.players[move.player];
  const graveIndex = ps.graveyard.findIndex((c) => c.instanceId === move.targetInstanceId);
  if (graveIndex === -1) {
    throw new GwentError('INVALID_TARGET', `${move.targetInstanceId} is not in your graveyard`);
  }
  const target = ps.graveyard[graveIndex];
  const def = getCardDef(target.defId);
  if (def.type !== 'unit') {
    throw new GwentError('INVALID_TARGET', 'medics can only revive non-hero units');
  }
  ps.graveyard.splice(graveIndex, 1);
  s.pendingChoice = null;
  // Full effects: revived spies draw 2, revived musters muster, revived
  // medics open the next link of the chain (a fresh pendingChoice).
  resolveUnitPlay(s, move.player, target, def, move.row);
}

/** Pull a non-hero unit out of the actor's graveyard or throw. */
function takeGraveyardUnit(s: GameState, player: PlayerId, targetInstanceId: string | undefined) {
  if (!targetInstanceId) {
    throw new GwentError('ILLEGAL_MOVE', 'this leader needs a graveyard unit as its target');
  }
  const ps = s.players[player];
  const graveIndex = ps.graveyard.findIndex((c) => c.instanceId === targetInstanceId);
  if (graveIndex === -1) {
    throw new GwentError('INVALID_TARGET', `${targetInstanceId} is not in your graveyard`);
  }
  const def = getCardDef(ps.graveyard[graveIndex].defId);
  if (def.type !== 'unit') {
    throw new GwentError('INVALID_TARGET', 'leaders can only target non-hero units');
  }
  const [card] = ps.graveyard.splice(graveIndex, 1);
  return { card, def };
}

function applyUseLeader(s: GameState, move: UseLeaderMove): void {
  const ps = s.players[move.player];
  if (ps.leaderUsed) {
    throw new GwentError('LEADER_UNAVAILABLE', 'leader ability already used');
  }
  const leaderDef = getCardDef(ps.leader.defId);
  switch (leaderDef.leaderAbility) {
    case 'weather_from_deck': {
      const kind = leaderDef.leaderWeather;
      const index = kind ? weatherIndexInDeck(ps, kind) : -1;
      if (index === -1) {
        throw new GwentError('LEADER_UNAVAILABLE', `no ${kind ?? 'weather'} left in your deck`);
      }
      const [weather] = ps.deck.splice(index, 1);
      s.weatherCards.push({ ...weather, owner: move.player });
      break;
    }
    case 'clear_weather': {
      if (s.weatherCards.length === 0) {
        throw new GwentError('LEADER_UNAVAILABLE', 'no weather to clear');
      }
      clearAllWeather(s);
      break;
    }
    case 'scorch_row_leader': {
      const row = leaderDef.leaderScorchRow;
      if (!row) {
        throw new GwentError('LEADER_UNAVAILABLE', 'leader has no scorch row configured');
      }
      const opp = opponentOf(move.player);
      if (rowTotal(s, opp, row) < 10) {
        throw new GwentError('LEADER_UNAVAILABLE', `opponent's ${row} row is below 10`);
      }
      resolveRowScorch(s, move.player, row);
      break;
    }
    case 'row_horn': {
      const row = leaderDef.leaderHornRow;
      if (!row) {
        throw new GwentError('LEADER_UNAVAILABLE', 'leader has no horn row configured');
      }
      if (ps.rows[row].horn !== null) {
        throw new GwentError('INVALID_TARGET', `the ${row} horn slot is occupied`);
      }
      // A marker, not a real card: it evaporates at round end.
      ps.rows[row].horn = {
        instanceId: `${move.player}:leader-horn`,
        defId: LEADER_HORN_MARKER_ID,
      };
      break;
    }
    case 'cancel_leader': {
      const opp = s.players[opponentOf(move.player)];
      if (opp.leaderUsed) {
        throw new GwentError('LEADER_UNAVAILABLE', "opponent's leader is already spent");
      }
      opp.leaderUsed = true; // their ability dies unspent
      break;
    }
    case 'peek_hand': {
      const oppHand = s.players[opponentOf(move.player)].hand;
      if (oppHand.length === 0) {
        throw new GwentError('LEADER_UNAVAILABLE', 'opponent has no cards in hand');
      }
      const [picked, rngState] = rngPick(s.rngState, oppHand, 3);
      s.rngState = rngState;
      for (const card of picked) {
        if (!ps.knownOpponentCardIds.includes(card.instanceId)) {
          ps.knownOpponentCardIds.push(card.instanceId);
        }
      }
      break;
    }
    case 'restore_to_hand': {
      const { card } = takeGraveyardUnit(s, move.player, move.targetInstanceId);
      ps.hand.push(card);
      break;
    }
    case 'play_from_graveyard': {
      const { card, def } = takeGraveyardUnit(s, move.player, move.targetInstanceId);
      // Full effects, exactly like a medic revival (spies draw, musters
      // muster, a revived medic opens a pendingChoice chain).
      resolveUnitPlay(s, move.player, card, def, move.row);
      break;
    }
    case 'steal_from_graveyard': {
      // The Relentless: lift a non-hero unit out of the ENEMY discard pile.
      const opp = s.players[opponentOf(move.player)];
      if (!move.targetInstanceId) {
        throw new GwentError('ILLEGAL_MOVE', 'choose a card in the enemy graveyard');
      }
      const index = opp.graveyard.findIndex((c) => c.instanceId === move.targetInstanceId);
      if (index === -1) {
        throw new GwentError('INVALID_TARGET', `${move.targetInstanceId} is not in the enemy graveyard`);
      }
      if (getCardDef(opp.graveyard[index].defId).type !== 'unit') {
        throw new GwentError('INVALID_TARGET', 'only non-hero units can be stolen'); // VERIFY vs W3
      }
      const [stolen] = opp.graveyard.splice(index, 1);
      ps.hand.push(stolen);
      break;
    }
    case 'discard_draw': {
      // Destroyer of Worlds: discard 2, then fetch any card from your deck.
      const ids = move.discardInstanceIds;
      if (!ids || ids.length !== 2 || new Set(ids).size !== 2) {
        throw new GwentError('ILLEGAL_MOVE', 'discard exactly 2 distinct hand cards');
      }
      if (!move.drawDefId) {
        throw new GwentError('ILLEGAL_MOVE', 'choose a card to fetch from your deck');
      }
      for (const id of ids) {
        const handIndex = ps.hand.findIndex((c) => c.instanceId === id);
        if (handIndex === -1) {
          throw new GwentError('CARD_NOT_FOUND', `${id} is not in your hand`);
        }
        const [discarded] = ps.hand.splice(handIndex, 1);
        ps.graveyard.push(discarded);
      }
      const deckIndex = ps.deck.findIndex((c) => c.defId === move.drawDefId);
      if (deckIndex === -1) {
        throw new GwentError('INVALID_TARGET', `no ${move.drawDefId} left in your deck`);
      }
      const [fetched] = ps.deck.splice(deckIndex, 1);
      ps.hand.push(fetched);
      break;
    }
    case 'draw_extra_start':
      // Auto-resolved at match start (extra card already drawn).
      throw new GwentError('LEADER_UNAVAILABLE', 'this ability triggers automatically');
    default:
      throw new GwentError('LEADER_UNAVAILABLE', 'this leader has no usable ability');
  }
  ps.leaderUsed = true;
}

// ---------------------------------------------------------------------------
// Turn handover, forced passes, round resolution
// ---------------------------------------------------------------------------

function endOfActionFlow(s: GameState): void {
  if (s.pendingChoice) {
    return; // medic chain open: the same player must resolve it next
  }
  if (PLAYER_IDS.every((p) => s.players[p].passed)) {
    resolveRound(s);
  } else {
    const opp = opponentOf(s.turn);
    if (!s.players[opp].passed) {
      s.turn = opp; // normal alternation
    }
    // else: opponent already passed → the actor keeps taking turns
  }
  enforceForcedPasses(s);
}

/** A player whose hand is empty when the turn reaches them is force-passed. */
function enforceForcedPasses(s: GameState): void {
  while (s.phase === 'play') {
    const ps = s.players[s.turn];
    if (ps.passed || ps.hand.length > 0) {
      return;
    }
    // Judgment call (matches the brief's literal rule): the force-pass fires
    // even if the player still has an unused leader ability.
    ps.passed = true;
    if (PLAYER_IDS.every((p) => s.players[p].passed)) {
      resolveRound(s); // may finish the match or set up the next round
    } else {
      s.turn = opponentOf(s.turn);
    }
  }
}

function resolveRound(s: GameState): void {
  const totals: Record<PlayerId, number> = {
    p1: sideTotal(s, 'p1'),
    p2: sideTotal(s, 'p2'),
  };

  let winner: PlayerId | null =
    totals.p1 > totals.p2 ? 'p1' : totals.p2 > totals.p1 ? 'p2' : null;
  let tieBrokenByNilfgaard = false;
  if (winner === null) {
    const ng1 = s.players.p1.faction === 'nilfgaard';
    const ng2 = s.players.p2.faction === 'nilfgaard';
    if (ng1 !== ng2) {
      // Nilfgaard perk: wins tied rounds. NG vs NG cancels out (true tie).
      winner = ng1 ? 'p1' : 'p2';
      tieBrokenByNilfgaard = true;
    }
  }

  s.roundHistory.push({
    round: s.round,
    totals,
    winner,
    ...(tieBrokenByNilfgaard ? { tieBrokenByNilfgaard } : {}),
  });

  if (winner === null) {
    s.players.p1.gems -= 1;
    s.players.p2.gems -= 1;
  } else {
    s.players[opponentOf(winner)].gems -= 1;
  }

  const p1Out = s.players.p1.gems <= 0;
  const p2Out = s.players.p2.gems <= 0;
  const matchOver = p1Out || p2Out;

  // Northern Realms perk: draw 1 on every round win (pointless once over).
  if (!matchOver && winner && s.players[winner].faction === 'northern_realms') {
    drawCards(s, winner, 1);
  }

  // Monsters perk: one RANDOM Monsters-faction unit stays on the board into
  // the next round. Heroes qualify (they are unit cards in W3); neutral
  // units in a Monsters deck do not.
  const kept: Partial<Record<PlayerId, string>> = {};
  if (!matchOver) {
    for (const p of PLAYER_IDS) {
      if (s.players[p].faction !== 'monsters') {
        continue;
      }
      const candidates: string[] = [];
      for (const rowKind of ROW_KINDS) {
        for (const unit of s.players[p].rows[rowKind].units) {
          const def = getCardDef(unit.defId);
          if (def.faction === 'monsters' && (def.type === 'unit' || def.type === 'hero')) {
            candidates.push(unit.instanceId);
          }
        }
      }
      if (candidates.length > 0) {
        const [index, rngState] = rngInt(s.rngState, candidates.length);
        s.rngState = rngState;
        kept[p] = candidates[index];
      }
    }
  }

  // Clear the board: every unit goes to the graveyard of the side it was on
  // (so enemy spies end up in YOUR graveyard, ready for medic revival), horns
  // and weather cards return to their owners' graveyards, weather clears.
  for (const p of PLAYER_IDS) {
    const ps = s.players[p];
    for (const rowKind of ROW_KINDS) {
      const row = ps.rows[rowKind];
      const surviving: CardInstance[] = [];
      for (const unit of row.units) {
        if (unit.instanceId === kept[p]) {
          surviving.push(unit);
        } else {
          ps.graveyard.push(unit);
        }
      }
      row.units = surviving;
      if (row.horn) {
        // Leader horn markers are not real cards — they simply evaporate.
        if (row.horn.defId !== LEADER_HORN_MARKER_ID) {
          ps.graveyard.push(row.horn);
        }
        row.horn = null;
      }
    }
  }
  for (const wc of s.weatherCards) {
    s.players[wc.owner].graveyard.push({ instanceId: wc.instanceId, defId: wc.defId });
  }
  s.weatherCards = [];

  if (matchOver) {
    s.phase = 'finished';
    s.result = {
      winner: p1Out && p2Out ? null : p1Out ? 'p2' : 'p1',
      gems: { p1: s.players.p1.gems, p2: s.players.p2.gems },
      rounds: s.roundHistory,
    };
    return;
  }

  s.round += 1;
  // VERIFY (brief is ~80% sure): the previous round's winner leads the next
  // round; after a true tie the same player who led keeps leading.
  s.roundLeader = winner ?? s.roundLeader;
  s.turn = s.roundLeader;
  s.players.p1.passed = false;
  s.players.p2.passed = false;
}
