import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { Colors, Radius, Spacing, Type } from '@/constants/theme';

type Props = {
  visible: boolean;
  name: string;
  onSave: (name: string) => void;
  onClose: () => void;
};

const MAX_LENGTH = 40;

/** Frosted bottom sheet with a single text field for the name shown on the Profile tab. */
export function NameSheet({ visible, name, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(name);

  const save = () => {
    onSave(draft.trim());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => setDraft(name)}
      onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel">
          <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        </Pressable>

        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(220)}
          style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <Glass strong intensity={80} radius={Radius.xl} style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.title} accessibilityRole="header">
                Your Name
              </Text>
              <Pressable onPress={save} hitSlop={10} accessibilityRole="button" accessibilityLabel="Save name">
                <Text style={styles.save}>Save</Text>
              </Pressable>
            </View>

            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Name"
              placeholderTextColor={Colors.labelTertiary}
              autoFocus
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={save}
              style={styles.input}
              accessibilityLabel="Your name"
            />
            <Text style={styles.footnote}>Only used on this screen. It stays on your phone.</Text>
          </Glass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.18)',
  },
  sheetWrap: {
    paddingHorizontal: Spacing.sm,
  },
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
  cancel: {
    ...Type.body,
    color: Colors.tint,
  },
  save: {
    ...Type.headline,
    color: Colors.tint,
  },
  input: {
    ...Type.body,
    marginTop: Spacing.lg,
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.glassHairline,
  },
  footnote: {
    ...Type.footnote,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
});
