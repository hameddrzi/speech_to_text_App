import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { FadeSwap } from '@/components/fade-swap';
import { Glass } from '@/components/glass';
import { GlassSwitch } from '@/components/profile/glass-switch';
import { NameSheet } from '@/components/profile/name-sheet';
import { OptionSheet } from '@/components/profile/option-sheet';
import { ProfileHero } from '@/components/profile/profile-hero';
import { ProfileStats } from '@/components/profile/profile-stats';
import { ProgressBar } from '@/components/profile/progress-bar';
import { SEPARATOR_INSET, SettingsRow, SettingsSection } from '@/components/profile/settings-list';
import { useModelDownload } from '@/stt/use-model-download';
import { Duration } from '@/constants/motion';
import { Colors, Radius, ScreenPadding, Spacing, TabBarBottomGap, TabBarHeight, Type } from '@/constants/theme';
import { transcriptText } from '@/data/recordings';
import { useRecordings } from '@/store/recordings';
import { MODELS } from '@/stt/models';
import { BYTES_PER_SECOND } from '@/stt/pcm';
import {
  AUTO_DELETE_OPTIONS,
  optionLabel,
  SPEECH_MODELS,
  useSettings,
  type AppSettings,
} from '@/store/settings';
import { haptic } from '@/utils/haptics';

const COMPACT_HEADER_HEIGHT = 44;

type SheetKind = 'model' | 'autoDelete' | 'name' | null;

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { recordings } = useRecordings();
  const { settings, update } = useSettings();
  const download = useModelDownload();
  const [sheet, setSheet] = useState<SheetKind>(null);

  const set = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      update(key, value);
      // update() applies the Haptics switch first, so turning it on is felt and turning it off is not.
      haptic.selection();
    },
    [update],
  );

  // ── Large-title → compact header on scroll ──
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [28, 52], [0, 1], 'clamp'),
  }));
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 36], [1, 0], 'clamp'),
    transform: [{ scale: interpolate(scrollY.get(), [-120, 0], [1.12, 1], 'clamp') }],
  }));

  // ── Derived values ──
  const model = SPEECH_MODELS.find((m) => m.value === settings.speechModel) ?? SPEECH_MODELS[0];
  const isDownloaded = download.downloaded.includes(model.value);
  const isDownloading = download.downloading === model.value;
  const downloadError = download.error?.model === model.value ? download.error.message : null;

  const storage = useMemo(() => {
    const audio = recordings.reduce((sum, r) => sum + r.duration * BYTES_PER_SECOND, 0);
    const text = recordings.reduce((sum, r) => sum + transcriptText(r).length * 2, 0);
    const models = MODELS.filter((m) => download.downloaded.includes(m.value)).reduce((sum, m) => sum + m.bytes, 0);
    const total = Math.max(1, audio + text + models);
    return { audio, text, models, total };
  }, [recordings, download.downloaded]);

  const bottomPad = TabBarHeight + Math.max(insets.bottom, TabBarBottomGap) + Spacing.xxxl;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.root}>
      <AmbientBackground variant="profile" />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm, paddingBottom: bottomPad }]}>
        <Animated.Text style={[styles.largeTitle, largeTitleStyle]} accessibilityRole="header">
          Profile
        </Animated.Text>

        <ProfileHero
          name={settings.displayName}
          subtitle={
            recordings.length === 0
              ? 'Voice notes, transcribed on this phone'
              : `${recordings.length} ${recordings.length === 1 ? 'recording' : 'recordings'} on this phone`
          }
          onEdit={() => {
            haptic.selection();
            setSheet('name');
          }}
        />

        {/* ── Stats ── */}
        <Text style={[styles.sectionHeader, { marginTop: Spacing.xxxl }]} accessibilityRole="header">
          ACTIVITY
        </Text>
        <ProfileStats recordings={recordings} />

        {/* ── Transcription ── */}
        <SettingsSection
          header="Transcription"
          footer="Speech is transcribed on this device with Whisper. Larger models are more accurate but slower and use more storage.">
          <SettingsRow
            icon="hardware-chip"
            iconColor="#5E5CE6"
            title="Speech Model"
            subtitle={`${model.detail} · ${model.hint}`}
            value={model.label}
            onPress={() => {
              haptic.selection();
              setSheet('model');
            }}
          />

          {/* Get → Downloading → Model Ready cross-fade instead of snapping. */}
          <FadeSwap swapKey={isDownloading ? 'downloading' : isDownloaded ? 'ready' : 'get'} duration={Duration.base}>
            {isDownloading ? (
              <SettingsRow
                icon="cloud-download"
                iconColor={Colors.tint}
                title={`Downloading ${model.label}…`}
                subtitle={`${Math.round(download.progress * 100)}% of ${model.detail}`}
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cancel download"
                    hitSlop={10}
                    onPress={() => {
                      haptic.selection();
                      download.cancel();
                    }}>
                    <Ionicons name="stop-circle" size={26} color={Colors.tint} />
                  </Pressable>
                }>
                <ProgressBar progress={download.progress} style={styles.inlineProgress} />
              </SettingsRow>
            ) : isDownloaded ? (
              <SettingsRow
                icon="checkmark-circle"
                iconColor={Colors.success}
                title="Model Ready"
                subtitle={`${model.label} · ${model.detail} on device`}
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${model.label} model`}
                    hitSlop={10}
                    onPress={() =>
                      Alert.alert(`Remove ${model.label} model?`, 'You can download it again at any time.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => download.remove(model.value) },
                      ])
                    }>
                    <Text style={styles.linkText}>Remove</Text>
                  </Pressable>
                }
              />
            ) : (
              <SettingsRow
                icon="cloud-download"
                iconColor={Colors.tint}
                title={downloadError ? 'Download Failed' : 'Download Model'}
                subtitle={downloadError ?? `${model.label} · ${model.detail} · needed to transcribe`}
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Download ${model.label} model, ${model.detail}`}
                    hitSlop={8}
                    onPress={() => {
                      haptic.light();
                      download.start(model.value);
                    }}
                    style={({ pressed }) => [styles.getPill, pressed && { opacity: 0.6 }]}>
                    <Text style={styles.getPillText}>GET</Text>
                  </Pressable>
                }
              />
            )}
          </FadeSwap>

          <SettingsRow
            icon="radio"
            iconColor={Colors.record}
            title="Live Transcript"
            subtitle="Show text while recording"
            accessory={
              <GlassSwitch
                accessibilityLabel="Live transcript while recording"
                value={settings.liveTranscript}
                onValueChange={(v) => set('liveTranscript', v)}
              />
            }
          />
        </SettingsSection>

        {/* ── Recording ── */}
        <SettingsSection
          header="Recording"
          footer="Recordings are saved as 16 kHz mono WAV, the format Whisper transcribes best — about 2 MB per minute.">
          <SettingsRow icon="mic" iconColor={Colors.record} title="Audio Format" value="WAV · 16 kHz" />
          <SettingsRow
            icon="pulse"
            iconColor="#FF2D55"
            title="Haptics"
            accessory={
              <GlassSwitch
                accessibilityLabel="Haptics"
                value={settings.haptics}
                onValueChange={(v) => set('haptics', v)}
              />
            }
          />
        </SettingsSection>

        {/* ── Storage ── */}
        <SettingsSection header="Storage" footer="Auto-delete runs each time the app starts. Favorites are always kept.">
          <View style={styles.storageCell} accessible accessibilityLabel={`Storage used: ${formatBytes(storage.total)}`}>
            <View style={styles.storageTop}>
              <Text style={Type.body}>Used</Text>
              <Text style={[Type.body, { color: Colors.labelSecondary }]}>{formatBytes(storage.total)}</Text>
            </View>
            <ProgressBar
              height={10}
              style={styles.storageBar}
              segments={[
                { value: storage.audio / storage.total, color: Colors.record },
                { value: storage.models / storage.total, color: '#5E5CE6' },
                { value: storage.text / storage.total, color: Colors.warning },
              ]}
            />
            <View style={styles.legend}>
              <LegendDot color={Colors.record} label="Recordings" value={formatBytes(storage.audio)} />
              <LegendDot color="#5E5CE6" label="Models" value={storage.models ? formatBytes(storage.models) : '—'} />
              <LegendDot color={Colors.warning} label="Transcripts" value={formatBytes(storage.text)} />
            </View>
          </View>
          <SettingsRow
            icon="trash"
            iconColor="#8E8E93"
            title="Delete Recordings"
            value={optionLabel(AUTO_DELETE_OPTIONS, settings.autoDelete)}
            onPress={() => {
              haptic.selection();
              setSheet('autoDelete');
            }}
          />
        </SettingsSection>

        {/* ── Privacy ── */}
        <SettingsSection
          header="Privacy"
          footer="Your audio and transcripts never leave this phone. Recording and speech recognition run entirely on device. No account needed, and the internet is only used once to download a speech model.">
          <SettingsRow
            icon="shield-checkmark"
            iconColor={Colors.success}
            title="On-Device Processing"
            accessory={
              <View style={styles.badge}>
                <Ionicons name="lock-closed" size={11} color={Colors.success} />
                <Text style={styles.badgeText}>On</Text>
              </View>
            }
          />
        </SettingsSection>

        {/* ── About ── */}
        <SettingsSection header="About">
          <SettingsRow icon="information-circle" iconColor="#8E8E93" title="Version" value={version} />
        </SettingsSection>
      </Animated.ScrollView>

      {/* Compact frosted nav bar that fades in once the large title scrolls away */}
      <Animated.View
        pointerEvents="none"
        style={[styles.compactHeader, { height: insets.top + COMPACT_HEADER_HEIGHT }, compactStyle]}>
        <Glass radius={0} elevated={false} intensity={60} strong style={StyleSheet.absoluteFill} />
        <View style={[styles.compactTitleWrap, { top: insets.top }]}>
          <Text style={Type.headline}>Profile</Text>
        </View>
        <View style={styles.compactHairline} />
      </Animated.View>

      <OptionSheet
        visible={sheet === 'model'}
        title="Speech Model"
        message="Whisper runs fully on device. Pick the balance of speed, accuracy and size that suits your phone."
        options={SPEECH_MODELS.map((m) => ({
          value: m.value,
          label: download.downloaded.includes(m.value) ? `${m.label}  ✓ on device` : m.label,
          detail: `${m.detail} · ${m.hint}`,
        }))}
        value={settings.speechModel}
        onSelect={(v) => set('speechModel', v)}
        onClose={() => setSheet(null)}
      />
      <NameSheet
        visible={sheet === 'name'}
        name={settings.displayName}
        onSave={(name) => update('displayName', name)}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'autoDelete'}
        title="Delete Recordings"
        message="Automatically remove recordings and their transcripts older than:"
        options={AUTO_DELETE_OPTIONS}
        value={settings.autoDelete}
        onSelect={(v) => set('autoDelete', v)}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View>
        <Text style={styles.legendLabel}>{label}</Text>
        <Text style={styles.legendValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: ScreenPadding,
  },
  largeTitle: {
    ...Type.largeTitle,
    marginBottom: Spacing.lg,
    transformOrigin: 'left',
  },
  sectionHeader: {
    ...Type.footnote,
    letterSpacing: 0.2,
    marginLeft: Spacing.lg,
    marginBottom: Spacing.sm - 1,
  },
  inlineProgress: {
    marginLeft: SEPARATOR_INSET,
    marginRight: Spacing.lg,
    marginBottom: Spacing.md,
  },
  linkText: {
    ...Type.body,
    color: Colors.record,
  },
  getPill: {
    minWidth: 64,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(118,118,128,0.12)',
    alignItems: 'center',
  },
  getPillText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: Colors.tint,
  },
  storageCell: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  storageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageBar: {
    marginTop: Spacing.md,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  legendLabel: {
    ...Type.caption,
    color: Colors.label,
  },
  legendValue: {
    ...Type.caption,
    fontWeight: '400',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(52,199,89,0.12)',
  },
  badgeText: {
    ...Type.footnote,
    fontWeight: '600',
    color: Colors.success,
  },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  compactTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: COMPACT_HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactHairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
});
