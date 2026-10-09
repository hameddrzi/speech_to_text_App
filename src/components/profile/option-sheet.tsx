import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Glass } from '@/components/glass';
import { Duration } from '@/constants/motion';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';
import type { Option } from '@/store/settings';

type Props<T extends string> = {
  visible: boolean;
  title: string;
  message?: string;
  options: Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

/** Frosted bottom sheet with an inset-grouped checkmark list — iOS picker style. */
export function OptionSheet<T extends string>({ visible, title, message, options, value, onSelect, onClose }: Props<T>) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Glass strong intensity={80} radius={Radius.xl} style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.list}>
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <View key={o.value}>
                {i > 0 && <View style={styles.separator} />}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={o.detail ? `${o.label}, ${o.detail}` : o.label}
                  onPress={() => {
                    onSelect(o.value);
                    // Let the checkmark move before the sheet slides away.
                    setTimeout(onClose, Duration.fast);
                  }}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                    {o.detail ? <Text style={styles.optionDetail}>{o.detail}</Text> : null}
                  </View>
                  {selected && <Ionicons name="checkmark" size={20} color={Colors.tint} />}
                </Pressable>
              </View>
            );
          })}
        </View>
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
  message: {
    ...Type.footnote,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.xs,
  },
  list: {
    marginTop: Spacing.lg,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassHairline,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
    marginLeft: Spacing.lg,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.md,
  },
  optionPressed: {
    backgroundColor: 'rgba(60,60,67,0.08)',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    ...Type.body,
  },
  optionDetail: {
    ...Type.footnote,
    marginTop: 2,
  },
});
