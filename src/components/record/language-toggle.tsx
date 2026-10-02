import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Colors, Radius, Shadow } from '@/constants/theme';

import type { RecordingLanguage } from '@/stt/types';

export type TranscriptLanguage = RecordingLanguage;

type Props = {
  value: TranscriptLanguage;
  onChange: (v: TranscriptLanguage) => void;
  disabled?: boolean;
};

const OPTIONS: { value: TranscriptLanguage; label: string; a11y: string }[] = [
  { value: 'fa', label: 'فارسی', a11y: 'Persian' },
  { value: 'en', label: 'EN', a11y: 'English' },
  { value: 'it', label: 'IT', a11y: 'Italian' },
];

const SEGMENT = 58;
const PAD = 3;

/** Small glass segmented pill choosing the transcript language, with a sliding white lens. */
export function LanguageToggle({ value, onChange, disabled }: Props) {
  const index = OPTIONS.findIndex((o) => o.value === value);
  const x = useSharedValue(index * SEGMENT);

  useEffect(() => {
    x.value = withSpring(index * SEGMENT, { damping: 18, stiffness: 220, mass: 0.7 });
  }, [index, x]);

  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Glass
      radius={Radius.pill}
      intensity={50}
      elevated={false}
      style={[styles.pill, disabled && styles.disabled]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Transcript language">
      <Animated.View style={[styles.lens, lensStyle]} />
      {OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.a11y}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => {
              if (selected) return;
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={styles.segment}>
            <Text style={[styles.label, { color: selected ? Colors.label : Colors.labelSecondary }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Glass>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    padding: PAD,
  },
  disabled: {
    opacity: 0.5,
  },
  lens: {
    position: 'absolute',
    top: PAD,
    left: PAD,
    width: SEGMENT,
    bottom: PAD,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassHairline,
    ...Shadow.soft,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segment: {
    width: SEGMENT,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
