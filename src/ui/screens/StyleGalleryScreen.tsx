/**
 * Design-system style gallery (dev/preview). Renders the type scale, color
 * roles, faction heraldry, buttons, panels, chips and the full icon set from
 * the tokens + primitives, so the system can be eyeballed on-device before it's
 * applied to real components. Reachable from the Home gear (long-press).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { color, faction, radius, space, typography } from '../tokens';
import { useAppStore } from '../store';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { Chip } from '../components/Chip';
import { Icon, type IconName } from '../components/Icon';
import { TiledSurface, type TextureName } from '../components/Material';
import { RuneDivider } from '../components/Ornament';
import { Panel } from '../components/Panel';
import { Text } from '../components/Text';

const TYPE_VARIANTS = Object.keys(typography) as (keyof typeof typography)[];

const ICONS: IconName[] = [
  'sword', 'bow', 'tower', 'frost', 'fog', 'rain', 'storm', 'clear',
  'spy', 'medic', 'muster', 'bond', 'moral', 'horn', 'agile', 'scorch', 'decoy',
  'crown', 'gem', 'grave', 'hand', 'deck', 'close', 'star',
];

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="accentBright" caps>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function CardCell({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.cardCell}>
      {children}
      <Text variant="caption" tone="dim">
        {label}
      </Text>
    </View>
  );
}

export function StyleGalleryScreen(): React.JSX.Element {
  const goHome = useAppStore((s) => s.goHome);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text variant="title" tone="accentBright">
          Style Gallery
        </Text>
        <Pressable onPress={goHome} hitSlop={10}>
          <Icon name="close" size={22} color={color.inkDim} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl, gap: space.lg }}>
        <Section title="Materials">
          <View style={styles.swatches}>
            {(['oakDark', 'oakMid', 'leather', 'parchment'] as TextureName[]).map((t) => (
              <View key={t} style={styles.swatchCell}>
                <TiledSurface texture={t} style={styles.tileSwatch} />
                <Text variant="caption" tone="dim">
                  {t}
                </Text>
              </View>
            ))}
          </View>
          <Panel keyline style={styles.ornatePanel}>
            <Text variant="caption">keyline panel + flourishes</Text>
          </Panel>
          <RuneDivider />
        </Section>

        <Section title="Card states">
          <View style={styles.cardRow}>
            <CardCell label="normal">
              <CardView defId="mon_forktail" size="hand" onField />
            </CardCell>
            <CardCell label="buffed">
              <CardView defId="mon_forktail" size="hand" onField effective={9} />
            </CardCell>
            <CardCell label="weakened">
              <CardView defId="mon_forktail" size="hand" onField effective={2} />
            </CardCell>
            <CardCell label="hero">
              <CardView defId="neu_geralt" size="hand" onField />
            </CardCell>
            <CardCell label="selected">
              <CardView defId="mon_forktail" size="hand" onField selected />
            </CardCell>
            <CardCell label="targetable">
              <CardView defId="mon_forktail" size="hand" onField highlighted />
            </CardCell>
            <CardCell label="dimmed">
              <CardView defId="mon_forktail" size="hand" onField dimmed />
            </CardCell>
          </View>
        </Section>

        <Section title="Type scale">
          {TYPE_VARIANTS.map((v) => (
            <View key={v} style={styles.typeRow}>
              <Text variant="caption" tone="dim" style={styles.typeName}>
                {v}
              </Text>
              <Text variant={v} style={{ flex: 1 }}>
                {v === 'numeral' ? '15' : v === 'caption' || v === 'body' || v === 'bodyStrong' || v === 'label'
                  ? 'The Witcher tavern, by candlelight.'
                  : 'Gwent'}
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Color roles">
          <View style={styles.swatches}>
            {(Object.entries(color) as [string, string][]).map(([name, val]) => (
              <View key={name} style={styles.swatchCell}>
                <View style={[styles.swatch, { backgroundColor: val }]} />
                <Text variant="caption" tone="dim">
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Faction heraldry">
          <View style={styles.swatches}>
            {(Object.entries(faction) as [string, { frame: string; accent: string; label: string }][]).map(
              ([key, f]) => (
                <View key={key} style={styles.swatchCell}>
                  <View style={[styles.swatch, { backgroundColor: f.frame, borderColor: f.accent, borderWidth: 2 }]} />
                  <Text variant="caption" color={f.accent}>
                    {f.label}
                  </Text>
                </View>
              ),
            )}
          </View>
        </Section>

        <Section title="Buttons">
          <View style={styles.col}>
            <Button label="Primary" onPress={() => {}} />
            <Button label="Ghost" variant="ghost" onPress={() => {}} />
            <Button label="Danger / Pass" variant="danger" onPress={() => {}} />
            <Button label="Disabled" disabled />
          </View>
        </Section>

        <Section title="Panels">
          <View style={styles.row}>
            <Panel style={styles.panelSample}>
              <Text variant="caption">surface</Text>
            </Panel>
            <Panel tone="raised" raised style={styles.panelSample}>
              <Text variant="caption">raised</Text>
            </Panel>
            <Panel tone="sunken" style={styles.panelSample}>
              <Text variant="caption">sunken</Text>
            </Panel>
            <Panel keyline style={styles.panelSample}>
              <Text variant="caption">keyline</Text>
            </Panel>
          </View>
        </Section>

        <Section title="Chips">
          <View style={styles.row}>
            <Chip>
              <Icon name="grave" size={14} color={color.inkDim} />
              <Text variant="caption">3</Text>
            </Chip>
            <Chip active>
              <Icon name="crown" size={14} color={color.accentBright} />
              <Text variant="caption" tone="accentBright">
                Ready
              </Text>
            </Chip>
            <Chip spent>
              <Icon name="crown" size={14} color={color.inkDim} />
              <Text variant="caption" tone="dim">
                Spent
              </Text>
            </Chip>
          </View>
        </Section>

        <Section title="Icons">
          <View style={styles.iconGrid}>
            {ICONS.map((n) => (
              <View key={n} style={styles.iconCell}>
                <Icon name={n} size={26} color={color.ink} />
                <Text variant="caption" tone="dim">
                  {n}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  section: { gap: space.sm },
  sectionBody: { gap: space.sm },
  typeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  typeName: { width: 64 },
  col: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swatchCell: { width: 72, alignItems: 'center', gap: 2 },
  swatch: {
    width: 56,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
  },
  panelSample: {
    width: 76,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  iconCell: { width: 56, alignItems: 'center', gap: 4 },
  cardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cardCell: { alignItems: 'center', gap: 4 },
  tileSwatch: {
    width: 72,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
  },
  ornatePanel: {
    padding: space.lg,
    alignItems: 'center',
  },
});
