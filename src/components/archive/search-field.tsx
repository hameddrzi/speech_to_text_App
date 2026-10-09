import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass } from '@/components/glass';
import { Duration, fadeIn, fadeOut } from '@/constants/motion';
import { TestIDs } from '@/constants/test-ids';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

const CLEAR_PAD = 10;

/** Frosted iOS-style search field. */
export function SearchField({ value, onChangeText, placeholder = 'Search' }: Props) {
  return (
    <Glass radius={Radius.md} elevated={false} intensity={30} style={styles.field}>
      <Ionicons name="search" size={17} color={Colors.labelSecondary} />
      <TextInput
        testID={TestIDs.archive.search}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.labelSecondary}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
        accessibilityLabel="Search recordings"
      />
      {value.length > 0 && (
        <Animated.View entering={fadeIn(Duration.fast)} exiting={fadeOut(Duration.fast)}>
          <Pressable
            testID={TestIDs.archive.searchClear}
            onPress={() => onChangeText('')}
            // Padding (cancelled by a negative margin) gives a 37 pt box inside the 38 pt field on every
            // platform; the slop takes it to 45 pt where hitSlop is supported.
            hitSlop={4}
            style={styles.clear}
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
  clear: {
    padding: CLEAR_PAD,
    margin: -CLEAR_PAD,
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
