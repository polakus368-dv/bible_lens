import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii } from "../theme";

type Props = {
  abbr: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function VersionChip({ abbr, onPress, disabled }: Props) {
  return (
    <Pressable
      style={[styles.chip, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Versión ${abbr}. Cambiar versión`}
    >
      <Text style={styles.text}>{abbr} ▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.navy,
    borderRadius: radii.sm,
    paddingHorizontal: 7,
    paddingVertical: 8,
  },
  text: { fontSize: 11, fontWeight: "800", color: colors.onDark },
  disabled: { opacity: 0.5 },
});
