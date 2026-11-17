import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";

/** The main action of a screen, or a quieter one with `quiet`. Shows a spinner and ignores presses while busy. */
export function Button({ label, onPress, busy = false, quiet = false, disabled = false }: { label: string; onPress: () => void; busy?: boolean; quiet?: boolean; disabled?: boolean }) {
  const c = useColors();
  const off = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.button, quiet ? { backgroundColor: c.brandSoft } : { backgroundColor: c.action }, (pressed || off) && styles.dim]}
    >
      {busy ? <ActivityIndicator color={quiet ? c.brandDeep : c.onAction} /> : <Text style={[styles.buttonText, { color: quiet ? c.brandDeep : c.onAction }]}>{label}</Text>}
    </Pressable>
  );
}

/** One choice in a row of choices, such as a deal or a city. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? c.brand : c.line, backgroundColor: selected ? c.brandSoft : c.surface }]}
    >
      <Text style={{ color: selected ? c.brandDeep : c.fg }}>{label}</Text>
    </Pressable>
  );
}

/** A row of chips where one or none is chosen; choosing the chosen one again clears it. */
export function ChipRow<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T | undefined; onChange: (value: T | undefined) => void; label: (value: T) => string }) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip key={option} label={label(option)} selected={value === option} onPress={() => onChange(value === option ? undefined : option)} />
      ))}
    </View>
  );
}

/** A labelled text field. */
export function Field({ label, ...input }: { label: string } & TextInputProps) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} style={[styles.input, { borderColor: c.line, color: c.fg, backgroundColor: c.surface }]} {...input} />
    </View>
  );
}

export function Heading({ children }: { children: string }) {
  const c = useColors();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: c.fg }]}>
      {children}
    </Text>
  );
}

export function Note({ children, tone = "muted" }: { children: string; tone?: "muted" | "danger" }) {
  const c = useColors();
  return <Text style={[styles.note, { color: tone === "danger" ? c.danger : c.muted }]}>{children}</Text>;
}

/** What a screen shows while it loads, when loading failed (with a retry), or when there is nothing to show. */
export function ScreenState({ state, onRetry, empty }: { state: "loading" | "failed" | "empty"; onRetry?: () => void; empty?: string }) {
  const c = useColors();
  const { t } = useLocale();
  return (
    <View style={styles.state}>
      {state === "loading" && <ActivityIndicator accessibilityLabel="loading" color={c.brand} size="large" />}
      {state === "failed" && (
        <>
          <Note>{t.mobile.loadFailed}</Note>
          {onRetry && <Button quiet label={t.mobile.retry} onPress={onRetry} />}
        </>
      )}
      {state === "empty" && empty !== undefined && <Note>{empty}</Note>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  buttonText: { fontSize: 16, fontWeight: "600" },
  dim: { opacity: 0.7 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 36, justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  field: { gap: space.xs },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: space.md, fontSize: 16 },
  heading: { fontSize: 22, fontWeight: "700" },
  note: { fontSize: 14, lineHeight: 20 },
  state: { padding: space.xl, gap: space.lg, alignItems: "center" },
});
