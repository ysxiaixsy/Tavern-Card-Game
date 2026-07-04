/**
 * How to Play — a scrollable primer on Witcher-3 Gwent (rules) and this app's
 * controls, for players new to the game. Reachable from Home and Settings.
 */

import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { color, space, sp } from '../tokens';
import { FACTION_EMBLEM } from '../factionArt';
import { factionTheme } from '../theme';
import { useAppStore, type PlayableFaction } from '../store';
import { Icon, type IconName } from '../components/Icon';
import { Panel } from '../components/Panel';
import { Text } from '../components/Text';

/** A titled section card: icon + heading, then body content. */
function Section({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Panel keyline style={styles.section}>
      <View style={styles.sectionHead}>
        <Icon name={icon} size={18} color={color.accentBright} />
        <Text variant="heading" tone="accentBright">
          {title}
        </Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Panel>
  );
}

/** A line of body copy. */
function P({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text variant="body">{children}</Text>;
}

/** An icon + label + description row, for enumerating cards/abilities. */
function Entry({ icon, name, desc }: { icon: IconName; name: string; desc: string }): React.JSX.Element {
  return (
    <View style={styles.entry}>
      <View style={styles.entryIcon}>
        <Icon name={icon} size={16} color={color.accent} />
      </View>
      <Text variant="body" style={styles.entryText}>
        <Text variant="bodyStrong" tone="accent">
          {name}
        </Text>
        {`  ${desc}`}
      </Text>
    </View>
  );
}

/** A faction row: emblem shield + accent-colored name + its perk. */
function FactionEntry({ faction, desc }: { faction: PlayableFaction; desc: string }): React.JSX.Element {
  const theme = factionTheme[faction];
  return (
    <View style={styles.entry}>
      <Image source={FACTION_EMBLEM[faction]} style={styles.entryEmblem} resizeMode="contain" />
      <Text variant="body" style={styles.entryText}>
        <Text variant="bodyStrong" color={theme.accent}>
          {theme.label}
        </Text>
        {`  ${desc}`}
      </Text>
    </View>
  );
}

export function HowToPlayScreen(): React.JSX.Element {
  const goHome = useAppStore((s) => s.goHome);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={goHome} hitSlop={10} style={styles.backRow}>
          <Icon name="back" size={16} color={color.accent} />
          <Text variant="label" tone="accent" caps>
            Home
          </Text>
        </Pressable>
        <Text variant="title" tone="accentBright">
          How to Play
        </Text>
        <View style={styles.backRow} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Section icon="crown" title="The goal">
          <P>
            Gwent is a best-of-three duel of card strength. Each round, both players build their side
            of the board; whoever has the higher total strength wins the round.
          </P>
          <P>
            You hold two gems — lose a round and you lose a gem (on a tie, both players lose one).
            Lose both gems and you lose the match, so winning two rounds wins the game.
          </P>
        </Section>

        <Section icon="hand" title="No draw step — make 10 cards last">
          <P>
            You're dealt 10 cards and may swap up to 2 at the start (the mulligan). That's it — there
            is no drawing during the match. The same hand must carry you through all three rounds, so
            card economy is everything.
          </P>
          <P>
            Because of this, deliberately passing to save cards is a real strategy: don't always
            spend everything to win round one.
          </P>
        </Section>

        <Section icon="star" title="Turns & passing">
          <P>
            Players alternate, each playing one card (or using a leader) per turn. You may Pass
            instead — but once you pass, you take no more actions for the rest of the round.
          </P>
          <P>When both players have passed, the round ends and totals are compared.</P>
        </Section>

        <Section icon="sword" title="Rows">
          <P>Your units sit in three combat rows. Your total is the sum of every unit's strength.</P>
          <Entry icon="sword" name="Melee" desc="front-line close combat." />
          <Entry icon="bow" name="Ranged" desc="archers and the like." />
          <Entry icon="tower" name="Siege" desc="back-line engines." />
          <Entry icon="agile" name="Agile" desc="may be placed in Melee or Ranged — you choose each time." />
        </Section>

        <Section icon="scorch" title="Special cards">
          <Entry icon="frost" name="Weather" desc="Frost/Fog/Rain crush a row to 1; Storm halves Ranged & Siege. Affects both sides." />
          <Entry icon="clear" name="Clear Weather" desc="removes all weather." />
          <Entry icon="horn" name="Commander's Horn" desc="doubles the strength of one of your rows." />
          <Entry icon="scorch" name="Scorch" desc="destroys the strongest non-hero unit(s) on the board." />
          <Entry icon="decoy" name="Decoy" desc="swap it for one of your units, returning that unit to your hand to replay later." />
          <Entry icon="mardroeme" name="Mardroeme" desc="transforms your Berserkers on a row into their stronger form." />
        </Section>

        <Section icon="medic" title="Unit abilities">
          <Entry icon="spy" name="Spy" desc="played on the enemy's side (it boosts their total), but you draw 2 cards." />
          <Entry icon="medic" name="Medic" desc="revive a non-hero unit from your graveyard and play it at once." />
          <Entry icon="muster" name="Muster" desc="also summons its kin from your hand and deck." />
          <Entry icon="bond" name="Tight Bond" desc="copies sharing a row multiply each other's strength." />
          <Entry icon="moral" name="Moral Boost" desc="gives every other unit in the row +1." />
          <Entry icon="star" name="Hero" desc="immune to weather, scorch and every other effect." />
        </Section>

        <Section icon="crown" title="Leaders">
          <P>
            Each deck is led by a Leader with a once-per-match ability. Tap your leader chip in
            battle, then press Play to use it — some resolve instantly, some ask you to pick a card.
          </P>
          <P>
            A few leaders are passive: their power is simply always on (the chip shows it as
            already spent).
          </P>
        </Section>

        <Section icon="gem" title="Factions">
          <P>Every faction fights by its own rule:</P>
          <FactionEntry faction="northern_realms" desc="draw an extra card whenever you win a round." />
          <FactionEntry faction="nilfgaard" desc="wins tied rounds instead of both sides losing a gem." />
          <FactionEntry faction="monsters" desc="keeps one random unit on the board between rounds." />
          <FactionEntry faction="scoiatael" desc="decides who takes the first turn of the match." />
          <FactionEntry faction="skellige" desc="two random units return from the graveyard when round 3 begins." />
        </Section>

        <Section icon="deck" title="Controls">
          <Entry icon="hand" name="Play a card" desc="drag it up onto a glowing row; agile cards light two rows. Release to play." />
          <Entry icon="frost" name="Weather" desc="drag onto the sky strip between the boards (it lights up gold)." />
          <Entry icon="scorch" name="Scorch" desc="drag over the field — the cards it will burn glow before you drop it." />
          <Entry icon="decoy" name="Decoy / targets" desc="drag onto a highlighted unit; the nearest valid unit is chosen." />
          <Entry icon="star" name="Tap a hand card" desc="opens View (info) and Play. Play guides any choice it still needs." />
          <Entry icon="grave" name="Card info" desc="tap any card on the board or in a graveyard to read it." />
          <Entry icon="deck" name="Deck roster" desc="hold a deck in any deck picker to browse every card in it." />
          <Entry icon="close" name="Pass" desc="the Pass button ends your round. Confirm steps live in Settings." />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp(4),
    paddingVertical: sp(3),
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: sp(1), minWidth: 72 },
  body: { padding: sp(4), paddingTop: 0, paddingBottom: sp(10), gap: space.md },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: sp(2) },
  sectionBody: { gap: space.sm },
  entry: { flexDirection: 'row', gap: sp(2), alignItems: 'flex-start' },
  entryIcon: { width: 20, alignItems: 'center', paddingTop: 2 },
  entryEmblem: { width: 28, height: 28, marginTop: -2 },
  entryText: { flex: 1 },
});
