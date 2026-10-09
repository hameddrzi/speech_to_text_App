import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Duration, fadeIn, fadeOut } from '@/constants/motion';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type Props = {
  /** 'blocked' → the OS won't prompt again, so we send the user to Settings. */
  blocked: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

/** Friendly glass card explaining why the microphone is needed, with a single clear action. */
export function PermissionCard({ blocked, onAllow, onOpenSettings, onDismiss }: Props) {
  return (
    <Animated.View entering={fadeIn(Duration.enter)} exiting={fadeOut()}>
      <Glass radius={Radius.lg} strong style={styles.card}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="mic-off" size={18} color={Colors.record} />
          </View>
          <View style={styles.texts}>
            <Text style={styles.title}>Microphone access needed</Text>
            <Text style={styles.body}>
              {blocked
                ? 'Turn on Microphone for this app in Settings to start recording.'
                : 'Allow microphone access so your voice can be recorded and transcribed.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={10}
            onPress={onDismiss}>
            <Ionicons name="close" size={18} color={Colors.labelTertiary} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={blocked ? 'Open Settings' : 'Allow microphone'}
          onPress={blocked ? onOpenSettings : onAllow}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
          <Text style={styles.buttonText}>{blocked ? 'Open Settings' : 'Allow Microphone'}</Text>
        </Pressable>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.recordSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Type.headline,
    fontSize: 15,
  },
  body: {
    ...Type.footnote,
    lineHeight: 18,
  },
  button: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.record,
  },
  buttonText: {
    ...Type.headline,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
