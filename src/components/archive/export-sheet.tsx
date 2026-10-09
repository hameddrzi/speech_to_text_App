import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BottomSheet } from '@/components/bottom-sheet';
import { Glass } from '@/components/glass';
import { Duration, fadeIn } from '@/constants/motion';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { Recording } from '@/data/recordings';
import {
  EXPORT_CAPABILITIES,
  exportTranscript,
  pickSaveFolder,
  saveFolderName,
  type ExportAction,
  type ExportOutcome,
} from '@/export/deliver';
import { unavailableReason, wordCount, type ExportFormat } from '@/export/shared';
import { formatDuration } from '@/utils/format';
import { haptic } from '@/utils/haptics';

type Props = {
  visible: boolean;
  recording: Recording;
  onClose: () => void;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; format: ExportFormat; action: ExportAction }
  | { kind: 'done'; outcome: Exclude<ExportOutcome, { kind: 'cancelled' | 'shared' }> }
  | { kind: 'error'; format?: ExportFormat; message: string };

type FormatOption = {
  format: ExportFormat;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
};

const FORMATS: FormatOption[] = [
  {
    format: 'pdf',
    title: 'PDF Document',
    subtitle: 'Designed page with timestamps — best for reading and printing',
    icon: 'document-text',
    iconColor: Colors.tint,
    iconBg: Colors.tintSoft,
  },
  {
    format: 'md',
    title: 'Markdown (.md)',
    subtitle: 'Plain text with headings — for notes apps',
    icon: 'logo-markdown',
    iconColor: Colors.label,
    iconBg: Colors.backgroundGrouped,
  },
];

const FADE = fadeIn(Duration.base);

const OPTION_IDS: Record<ExportFormat, { option: string; share: string }> = {
  pdf: { option: TestIDs.exportSheet.optionPdf, share: TestIDs.exportSheet.sharePdf },
  md: { option: TestIDs.exportSheet.optionMd, share: TestIDs.exportSheet.shareMd },
};

function successText(o: Exclude<ExportOutcome, { kind: 'cancelled' | 'shared' }>): string {
  switch (o.kind) {
    case 'saved':
      return `Saved “${o.fileName}” to ${o.folder}.`;
    case 'downloaded':
      return `Downloaded “${o.fileName}”.`;
    case 'printed':
      return 'Print dialog opened. Choose “Save as PDF” to keep the file.';
  }
}

/** "Export Transcript" sheet: pick PDF or Markdown, then save (Android folder / iOS share sheet / web download). */
export function ExportSheet({ visible, recording, onClose }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [folder, setFolder] = useState(() => saveFolderName());
  const [wasVisible, setWasVisible] = useState(visible);

  // Fresh state every time the sheet opens (state adjustment during render, no effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setStatus({ kind: 'idle' });
      setFolder(saveFolderName());
    }
  }

  const busy = status.kind === 'busy';
  const unavailable = unavailableReason(recording);
  const words = unavailable ? 0 : wordCount(recording);

  const run = async (format: ExportFormat, action: ExportAction) => {
    if (busy) return;
    haptic.selection();
    setStatus({ kind: 'busy', format, action });
    try {
      const outcome = await exportTranscript(recording, format, action);
      // The share sheet doesn't report whether the user saved or dismissed it, so claim nothing.
      if (outcome.kind === 'cancelled' || outcome.kind === 'shared') {
        setStatus({ kind: 'idle' });
        return;
      }
      if (outcome.kind === 'saved') setFolder(outcome.folder);
      haptic.success();
      setStatus({ kind: 'done', outcome });
    } catch (e) {
      haptic.warning();
      const message = e instanceof Error && e.message ? e.message : 'Something went wrong.';
      setStatus({ kind: 'error', format, message });
    }
  };

  const changeFolder = async () => {
    if (busy) return;
    haptic.selection();
    try {
      const picked = await pickSaveFolder();
      if (picked) setFolder(picked);
    } catch (e) {
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Could not open the folder picker.' });
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close}>
      <Glass testID={TestIDs.exportSheet.sheet} strong intensity={80} radius={Radius.xl} style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">
            Export Transcript
          </Text>
          <Pressable
            testID={TestIDs.exportSheet.done}
            onPress={close}
            disabled={busy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Done">
            <Text style={[styles.done, busy && styles.disabledText]}>Done</Text>
          </Pressable>
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {unavailable
            ? `${unavailable.title}. The exported file will say so and include the recording details only.`
            : `${recording.title} · ${formatDuration(recording.duration)} · ${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`}
        </Text>

        <View style={styles.options}>
          {FORMATS.map((o) => {
            const working = status.kind === 'busy' && status.format === o.format;
            const note = o.format === 'pdf' ? EXPORT_CAPABILITIES.pdfNote : undefined;
            return (
              <Pressable
                key={o.format}
                testID={OPTION_IDS[o.format].option}
                onPress={() => run(o.format, 'save')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${o.title}. ${o.subtitle}`}
                accessibilityState={{ busy: working, disabled: busy && !working }}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.optionPressed,
                  busy && !working && styles.optionDimmed,
                ]}>
                <View style={[styles.optionIcon, { backgroundColor: o.iconBg }]}>
                  <Ionicons name={o.icon} size={24} color={o.iconColor} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{o.title}</Text>
                  <Text style={styles.optionSubtitle}>{working ? 'Preparing…' : o.subtitle}</Text>
                  {note && !working ? <Text style={styles.optionNote}>{note}</Text> : null}
                </View>
                {working ? (
                  <ActivityIndicator color={Colors.labelSecondary} style={styles.trailing} />
                ) : EXPORT_CAPABILITIES.saveToFolder && EXPORT_CAPABILITIES.share ? (
                  <Pressable
                    testID={OPTION_IDS[o.format].share}
                    onPress={() => run(o.format, 'share')}
                    disabled={busy}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${o.format === 'pdf' ? 'PDF' : 'Markdown'} file`}
                    style={({ pressed }) => [styles.shareButton, pressed && styles.shareButtonPressed]}>
                    <Ionicons name="share-social-outline" size={18} color={Colors.tint} />
                  </Pressable>
                ) : (
                  <Ionicons name="arrow-down-circle-outline" size={24} color={Colors.labelTertiary} style={styles.trailing} />
                )}
              </Pressable>
            );
          })}
        </View>

        {status.kind === 'done' && (
          <Animated.View
            testID={TestIDs.exportSheet.success}
            entering={FADE}
            style={[styles.banner, styles.bannerSuccess]}
            accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={18} color={Colors.successText} />
            <Text style={[styles.bannerText, styles.bannerTextSuccess]}>{successText(status.outcome)}</Text>
          </Animated.View>
        )}
        {status.kind === 'error' && (
          <Animated.View
            testID={TestIDs.exportSheet.error}
            entering={FADE}
            style={[styles.banner, styles.bannerError]}
            accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color={Colors.warningText} />
            <View style={styles.bannerBody}>
              <Text style={[styles.bannerText, styles.bannerTextError]}>Export failed: {status.message}</Text>
              {EXPORT_CAPABILITIES.saveToFolder && status.format && (
                <Pressable
                  onPress={() => run(status.format ?? 'pdf', 'share')}
                  accessibilityRole="button"
                  hitSlop={6}>
                  <Text style={styles.bannerAction}>Share file instead…</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {EXPORT_CAPABILITIES.saveToFolder && (
          <View style={styles.footer}>
            <Ionicons name="folder-outline" size={15} color={Colors.labelSecondary} />
            <Text style={styles.footerText} numberOfLines={1}>
              {folder ? `Saves to ${folder}` : 'You’ll choose a folder the first time'}
            </Text>
            {folder ? (
              <Pressable
                testID={TestIDs.exportSheet.changeFolder}
                onPress={changeFolder}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button">
                <Text style={[styles.footerAction, busy && styles.disabledText]}>Change</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Glass>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(60,60,67,0.3)',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  title: {
    ...Type.headline,
  },
  done: {
    ...Type.headline,
    color: Colors.tint,
  },
  disabledText: {
    opacity: 0.4,
  },
  message: {
    ...Type.footnote,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.xs,
  },
  options: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 76,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassHairline,
  },
  optionPressed: {
    backgroundColor: 'rgba(235,235,240,0.95)',
  },
  optionDimmed: {
    opacity: 0.45,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    ...Type.headline,
  },
  optionSubtitle: {
    ...Type.footnote,
    marginTop: 2,
  },
  optionNote: {
    ...Type.caption,
    color: Colors.tint,
    marginTop: Spacing.xs,
  },
  trailing: {
    width: 36,
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.tintSoft,
  },
  shareButtonPressed: {
    opacity: 0.55,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  bannerSuccess: {
    backgroundColor: Colors.successSoft,
  },
  bannerError: {
    backgroundColor: Colors.warningSoft,
  },
  bannerBody: {
    flex: 1,
    gap: Spacing.xs,
  },
  bannerText: {
    ...Type.footnote,
    flex: 1,
    fontWeight: '500',
  },
  bannerTextSuccess: {
    color: Colors.successText,
  },
  bannerTextError: {
    color: Colors.warningText,
  },
  bannerAction: {
    ...Type.footnote,
    fontWeight: '600',
    color: Colors.tint,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  footerText: {
    ...Type.footnote,
    flex: 1,
  },
  footerAction: {
    ...Type.footnote,
    fontWeight: '600',
    color: Colors.tint,
  },
});
