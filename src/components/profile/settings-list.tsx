import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Timing } from '@/constants/motion';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const ROW_PADDING = Spacing.lg;
const ICON_SIZE = 29;
const ICON_GAP = Spacing.md;
/** Separators start where the title text starts, like iOS Settings. */
export const SEPARATOR_INSET = ROW_PADDING + ICON_SIZE + ICON_GAP;

/** Rounded-square colored icon tile (iOS Settings). */
export function IconTile({ name, color, size = ICON_SIZE }: { name: IconName; color: string; size?: number }) {
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * 0.24, backgroundColor: color }]}>
      <Ionicons name={name} size={size * 0.62} color="#FFFFFF" />
    </View>
  );
}

type SectionProps = {
  header?: string;
  footer?: ReactNode;
  children: ReactNode;
  /** Left inset of separators; use 0 / ROW_PADDING for groups without icon tiles. */
  separatorInset?: number;
  style?: StyleProp<ViewStyle>;
};

/** iOS inset-grouped section on a frosted glass card with footnote header & footer. */
export function SettingsSection({ header, footer, children, separatorInset = SEPARATOR_INSET, style }: SectionProps) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.section, style]}>
      {header ? (
        <Text style={styles.header} accessibilityRole="header">
          {header.toUpperCase()}
        </Text>
      ) : null}
      <Glass strong radius={Radius.lg} intensity={50}>
        <View style={styles.clip}>
          {rows.map((row, i) => (
            <View key={i}>
              {i > 0 && <View style={[styles.separator, { marginLeft: separatorInset }]} />}
              {row}
            </View>
          ))}
        </View>
      </Glass>
      {footer ? (
        typeof footer === 'string' ? <Text style={styles.footer}>{footer}</Text> : footer
      ) : null}
    </View>
  );
}

type RowProps = {
  icon: IconName;
  iconColor: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  /** Right-side custom accessory (switch, badge…). Replaces value + chevron. */
  accessory?: ReactNode;
  /** Defaults to true when onPress is set and no accessory. */
  chevron?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
  children?: ReactNode;
  testID?: string;
};

/** One row: icon tile · title/subtitle · value · chevron | accessory. Press = gray highlight + tiny scale. */
export function SettingsRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onPress,
  accessory,
  chevron,
  destructive,
  accessibilityHint,
  children,
  testID,
}: RowProps) {
  const pressed = useSharedValue(0);
  const showChevron = chevron ?? (!!onPress && !accessory);

  const animatedStyle = useAnimatedStyle(() => ({
    // interpolateColor, not a template string: a settling spring reaches values like 1e-8, and Android
    // crashes on a color such as "rgba(60,60,67,1e-8)".
    backgroundColor: interpolateColor(pressed.get(), [0, 1], ['rgba(60,60,67,0)', 'rgba(60,60,67,0.1)']),
    transform: [{ scale: 1 - pressed.get() * 0.012 }],
  }));

  const content = (
    <>
      <View style={styles.row}>
        <IconTile name={icon} color={iconColor} />
        <View style={styles.titleWrap}>
          <Text style={[styles.title, destructive && { color: Colors.record }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {accessory ?? (
          <View style={styles.trailing}>
            {value ? (
              <Text style={styles.value} numberOfLines={1}>
                {value}
              </Text>
            ) : null}
            {showChevron && <Ionicons name="chevron-forward" size={17} color={Colors.labelTertiary} />}
          </View>
        )}
      </View>
      {children}
    </>
  );

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessible={!accessory}
        accessibilityLabel={value ? `${title}, ${value}` : title}
        accessibilityHint={accessibilityHint}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={() => {
        pressed.set(withTiming(1, Timing.pressIn));
      }}
      onPressOut={() => {
        // Highlight in instantly, fade out gently (iOS Settings).
        pressed.set(withTiming(0, Timing.pressOut));
      }}>
      <Animated.View style={animatedStyle}>{content}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.xxl,
  },
  header: {
    ...Type.footnote,
    letterSpacing: 0.2,
    marginLeft: ROW_PADDING,
    marginBottom: Spacing.sm - 1,
  },
  footer: {
    ...Type.footnote,
    marginHorizontal: ROW_PADDING,
    marginTop: Spacing.sm - 1,
    lineHeight: 18,
  },
  clip: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separator,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: ROW_PADDING,
    paddingRight: ROW_PADDING - 2,
    paddingVertical: Spacing.sm,
    gap: ICON_GAP,
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    ...Type.body,
  },
  subtitle: {
    ...Type.footnote,
    marginTop: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '55%',
  },
  value: {
    ...Type.body,
    color: Colors.labelSecondary,
  },
});
