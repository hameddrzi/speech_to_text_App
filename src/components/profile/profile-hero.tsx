import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

const AVATAR = 96;
const RING = 5;

type Props = {
  name: string;
  subtitle: string;
  onEdit: () => void;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Apple ID–style header: gradient initials avatar inside a glass ring, name, subtitle, "Edit" glass pill. */
export function ProfileHero({ name, subtitle, onEdit }: Props) {
  const scale = useSharedValue(1);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.root}>
      <Glass radius={Radius.pill} intensity={50} style={styles.ring}>
        <LinearGradient
          colors={['#FFB4A8', '#C7A6FF', '#8EC5FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}>
          <LinearGradient
            colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.initials} accessibilityElementsHidden importantForAccessibility="no">
            {initials(name)}
          </Text>
        </LinearGradient>
      </Glass>

      <Text style={styles.name} accessibilityRole="header">
        {name}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        onPress={onEdit}
        onPressIn={() => {
          scale.set(withSpring(0.94, { damping: 16, stiffness: 320 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
        }}>
        <Animated.View style={pillStyle}>
          <Glass radius={Radius.pill} intensity={50} strong style={styles.pill}>
            <Text style={styles.pillText}>Edit</Text>
          </Glass>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  ring: {
    padding: RING,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 40,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#FFFFFF',
    textShadowColor: 'rgba(15,23,42,0.18)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  name: {
    ...Type.title2,
    fontSize: 26,
    marginTop: Spacing.md,
  },
  subtitle: {
    ...Type.subhead,
    marginTop: Spacing.xxs,
  },
  pill: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 7,
  },
  pillText: {
    ...Type.subhead,
    fontWeight: '600',
    color: Colors.tint,
  },
});
