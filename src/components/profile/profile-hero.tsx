import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { PressScale, Spring, Timing } from '@/constants/motion';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

const AVATAR = 96;
const RING = 5;

type Props = {
  /** Empty until the user adds one; the hero then invites them to. */
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
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

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
          {name ? (
            <Text style={styles.initials} accessibilityElementsHidden importantForAccessibility="no">
              {initials(name)}
            </Text>
          ) : (
            <Ionicons name="person" size={44} color="#FFFFFF" style={styles.placeholderIcon} />
          )}
        </LinearGradient>
      </Glass>

      {/* Long names wrap to two centered lines; on native they shrink a little before they truncate. */}
      <Text
        style={[styles.name, (name?.length ?? 0) > LONG_NAME && styles.nameLong]}
        accessibilityRole="header"
        numberOfLines={2}
        adjustsFontSizeToFit={Platform.OS !== 'web'}
        minimumFontScale={0.75}>
        {name || 'Voice'}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <Pressable
        testID={TestIDs.profile.nameEdit}
        accessibilityRole="button"
        accessibilityLabel={name ? 'Edit name' : 'Add your name'}
        hitSlop={6}
        onPress={onEdit}
        onPressIn={() => {
          scale.set(withTiming(PressScale.button, Timing.pressIn));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, Spring.press));
        }}>
        <Animated.View style={pillStyle}>
          <Glass radius={Radius.pill} intensity={50} strong style={styles.pill}>
            <Text style={styles.pillText}>{name ? 'Edit Name' : 'Add Your Name'}</Text>
          </Glass>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** Names longer than this start one size smaller (web has no adjustsFontSizeToFit). */
const LONG_NAME = 24;

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
  placeholderIcon: {
    opacity: 0.95,
  },
  name: {
    ...Type.title2,
    fontSize: 26,
    marginTop: Spacing.md,
    maxWidth: '90%',
    textAlign: 'center',
  },
  nameLong: {
    fontSize: 22,
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
