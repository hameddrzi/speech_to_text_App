import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { isRTL } from '@/utils/format';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

/** Frosted iOS-style search field. Switches to RTL as soon as the query is Persian. */
export function SearchField({ value, onChangeText, placeholder = 'Search' }: Props) {
  const rtl = isRTL(value);
  return (
    <Glass radius={Radius.md} elevated={false} intensity={30} style={styles.field}>
      <Ionicons name="search" size={17} color={Colors.labelSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.labelSecondary}
        style={[styles.input, { textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }]}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        accessibilityLabel="Search recordings"
      />
      {value.length > 0 && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={17} color={Colors.labelTertiary} />
          </Pressable>
        </Animated.View>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    backgroundColor: 'rgba(118,118,128,0.08)',
  },
  input: {
    // Positioned so it paints above the Glass blur layer on web (static inputs render beneath it).
    position: 'relative',
    flex: 1,
    height: '100%',
    fontSize: 17,
    letterSpacing: -0.41,
    color: Colors.label,
    paddingVertical: 0,
  },
});
