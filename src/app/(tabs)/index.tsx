import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/ambient-background';
import { FadeSwap } from '@/components/fade-swap';
import { Glass } from '@/components/glass';
import { ControlButton } from '@/components/record/control-button';
import { LiveTranscriptCard } from '@/components/record/live-transcript-card';
import { LiveWaveform } from '@/components/record/live-waveform';
import { ModelPill } from '@/components/record/model-pill';
import { PermissionCard } from '@/components/record/permission-card';
import { RecordButton } from '@/components/record/record-button';
import { RecordStatus } from '@/components/record/record-status';
import { SavedToast } from '@/components/record/saved-toast';
import { downsampleLevels } from '@/components/record/waveform-utils';
import { Timing } from '@/constants/motion';
import {
  Colors,
  Radius,
  ScreenPadding,
  Spacing,
  TabBarBottomGap,
  TabBarHeight,
  Type,
} from '@/constants/theme';
import type { Recording } from '@/data/recordings';
import { RECORD_TICK_MS, useRecordSession } from '@/hooks/record-session';
import { useRecordings } from '@/store/recordings';
import { useSettings } from '@/store/settings';
import { STT_SUPPORTED } from '@/stt/model-files';
import { useSelectedModelReady } from '@/stt/use-model-download';
import { formatTimer } from '@/utils/format';
import { haptic } from '@/utils/haptics';

const isWeb = Platform.OS === 'web';

function nextRecordingTitle(recordings: Recording[]): string {
  let max = 0;
  for (const r of recordings) {
    const m = /^New Recording(?: (\d+))?$/.exec(r.title);
    if (m) max = Math.max(max, m[1] ? Number(m[1]) : 1);
  }
  return max === 0 ? 'New Recording' : `New Recording ${max + 1}`;
}

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const compact = windowHeight < 720;

  const { recordings, addRecording } = useRecordings();
  const session = useRecordSession();
  const { phase, elapsedMs, samples, permission } = session;

  const { settings } = useSettings();
  const modelReady = useSelectedModelReady();
  const takeIdRef = useRef<string | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);

  // Rolling on-device Whisper preview while recording (empty on web or when disabled in Profile).
  const liveTranscript = session.liveText;
  const transcriptHint = !STT_SUPPORTED
    ? 'Live transcription runs in the phone app.'
    : !modelReady
      ? 'Download a speech model in Profile to see your words here while you record.'
      : !settings.liveTranscript
        ? 'Live transcript is off. Your recording is transcribed after you stop.'
        : undefined;

  const isActive = phase === 'recording' || phase === 'paused';
  const busy = phase === 'starting' || phase === 'saving';

  // The timer brightens from tertiary gray to full black as a take starts (color via interpolateColor).
  const timerOn = useSharedValue(isActive ? 1 : 0);
  useEffect(() => {
    timerOn.set(withTiming(isActive ? 1 : 0, Timing.fade));
  }, [isActive, timerOn]);
  const timerStyle = useAnimatedStyle(() => ({
    color: interpolateColor(timerOn.get(), [0, 1], [Colors.labelTertiary, Colors.label]),
  }));
  const nextTitle = nextRecordingTitle(recordings);
  const bottomSpace = TabBarHeight + Math.max(insets.bottom, TabBarBottomGap) + Spacing.lg;

  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const save = useCallback(async () => {
    const result = await session.stop();
    if (!result) return;
    const rec: Recording = {
      id: takeIdRef.current ?? `rec-${Date.now()}`,
      title: nextTitle,
      createdAt: new Date().toISOString(),
      duration: Math.max(1, Math.round(result.durationMs / 1000)),
      uri: result.uri,
      waveform: downsampleLevels(result.levels, 90),
      transcript: [],
      // The background TranscriptionWorker picks this up and runs the accurate on-device pass.
      transcriptStatus: result.uri ? 'processing' : 'none',
      favorite: false,
    };
    addRecording(rec);
    setToast({ id: rec.id, title: rec.title });
    haptic.success();
  }, [session, nextTitle, addRecording]);

  const onRecordPress = useCallback(async () => {
    if (phase === 'idle') {
      setToast(null);
      haptic.medium();
      takeIdRef.current = `rec-${Date.now()}`;
      await session.start({
        id: takeIdRef.current,
        model: settings.speechModel,
        liveTranscript: settings.liveTranscript,
      });
    } else if (isActive) {
      await save();
    }
  }, [phase, isActive, session, save, settings.speechModel, settings.liveTranscript]);

  const onPauseResume = useCallback(() => {
    haptic.selection();
    if (phase === 'recording') session.pause();
    else if (phase === 'paused') session.resume();
  }, [phase, session]);

  const onDiscard = useCallback(() => {
    const doDiscard = () => {
      haptic.warning();
      session.discard();
    };
    if (isWeb) {
      if (globalThis.confirm?.('Delete this recording?') ?? true) doDiscard();
      return;
    }
    Alert.alert('Delete this recording?', 'This take will not be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDiscard },
    ]);
  }, [session]);

  const dismissToast = useCallback(() => setToast(null), []);
  const viewArchive = useCallback(() => {
    setToast(null);
    router.navigate('/archive');
  }, []);

  const showPermissionCard = permission === 'denied' || permission === 'blocked';

  return (
    <View style={styles.screen}>
      <AmbientBackground variant="record" />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + (compact ? Spacing.sm : Spacing.lg), paddingBottom: bottomSpace },
        ]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={Type.largeTitle} accessibilityRole="header">
              Record
            </Text>
            <FadeSwap swapKey={isActive ? 'take' : 'today'}>
              <Text style={styles.subtitle} numberOfLines={1}>
                {isActive ? nextTitle : today}
              </Text>
            </FadeSwap>
          </View>
          <ModelPill disabled={isActive || busy} />
        </View>

        {/* Stage: timer + live waveform */}
        <View style={styles.stage}>
          <View style={styles.timerBlock}>
            <Animated.Text
              style={[styles.timer, compact && styles.timerCompact, timerStyle]}
              accessibilityRole="timer"
              accessibilityLabel={`Elapsed ${Math.floor(elapsedMs / 1000)} seconds`}>
              {formatTimer(elapsedMs)}
            </Animated.Text>
            <RecordStatus phase={phase} message={session.error} simulated={session.simulated} />
          </View>

          <LiveWaveform
            samples={samples}
            phase={phase}
            tickMs={RECORD_TICK_MS}
            height={compact ? 112 : 160}
            hint="Tap the record button to begin"
          />
        </View>

        {/* Transcript or permission prompt */}
        {showPermissionCard ? (
          <PermissionCard
            blocked={permission === 'blocked'}
            onAllow={onRecordPress}
            onOpenSettings={session.openSettings}
            onDismiss={session.dismissPermission}
          />
        ) : (
          <LiveTranscriptCard
            text={liveTranscript}
            hint={transcriptHint}
            active={phase === 'recording'}
            height={compact ? 38 : 64}
          />
        )}

        {/* Controls */}
        <Glass radius={Radius.xl} intensity={55} style={styles.controls}>
          <ControlButton
            icon="trash-outline"
            accessibilityLabel="Discard recording"
            onPress={onDiscard}
            disabled={!isActive}
            color={Colors.record}
          />
          <RecordButton
            recording={isActive || phase === 'saving'}
            live={phase === 'recording'}
            onPress={onRecordPress}
            disabled={busy}
            size={compact ? 70 : 78}
            accessibilityLabel={isActive ? 'Stop and save recording' : 'Start recording'}
          />
          <ControlButton
            icon={phase === 'paused' ? 'play' : 'pause'}
            accessibilityLabel={phase === 'paused' ? 'Resume recording' : 'Pause recording'}
            onPress={onPauseResume}
            disabled={!isActive}
            color={phase === 'paused' ? Colors.record : Colors.label}
          />
        </Glass>
      </View>

      {toast ? (
        <SavedToast
          key={toast.id}
          title={toast.title}
          top={insets.top + Spacing.sm}
          onView={viewArchive}
          onDismiss={dismissToast}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: ScreenPadding,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    ...Type.subhead,
    marginTop: Spacing.xxs,
  },
  stage: {
    flex: 1,
    minHeight: 160,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  timerBlock: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  timer: {
    ...Type.timer,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  timerCompact: {
    fontSize: 46,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
});
