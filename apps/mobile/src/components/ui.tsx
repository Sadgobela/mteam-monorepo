import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type PressableStateCallbackType, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Children, Fragment, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";
import { MarkLoader } from "./Brand";

/** A Pressable style that dims while pressed. */
export const dimWhenPressed =
  (style: StyleProp<ViewStyle>) =>
  ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [style, pressed && styles.dim];

/**
 * The main action of a screen, or a quieter one with `quiet`; `color` paints it another colour (WhatsApp's green) and
 * `icon` puts an icon before the words. Shows a spinner and ignores presses while busy.
 */
export function Button({
  label,
  onPress,
  busy = false,
  quiet = false,
  disabled = false,
  color,
  icon,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  quiet?: boolean;
  disabled?: boolean;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const c = useColors();
  const off = busy || disabled;
  const ink = quiet ? c.brandDeep : c.onAction;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: color ?? (quiet ? c.brandSoft : c.action) }, (pressed || off) && styles.dim]}
    >
      {busy ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={ink} />}
          <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>
        </>
      )}
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
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
  scroll = false,
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  label: (value: T) => string;
  /** One line that scrolls sideways instead of wrapping onto several, to keep a long list short. */
  scroll?: boolean;
}) {
  const chips = options.map((option) => <Chip key={option} label={label(option)} selected={value === option} onPress={() => onChange(value === option ? undefined : option)} />);
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipLine}>
      {chips}
    </ScrollView>
  ) : (
    <View style={styles.chips}>{chips}</View>
  );
}

/** Two to four choices side by side in one track, one always chosen, as the site's deal switch. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (value: T) => void; label: (value: T) => string }) {
  const c = useColors();
  return (
    <View style={[styles.track, { backgroundColor: c.brandSoft }]}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option)}
            style={[styles.segment, on && { backgroundColor: c.surface }]}
          >
            <Text style={[styles.segmentText, { color: on ? c.brandDeep : c.muted }]}>{label(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One line of a menu (the account's): an icon, the words and an arrow, opening another screen. */
export function MenuRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={dimWhenPressed(styles.menuRow)}>
      <View style={[styles.menuIcon, { backgroundColor: c.brandSoft }]}>
        <Ionicons name={icon} size={18} color={c.brandDeep} />
      </View>
      <Text style={[styles.menuText, { color: c.fg }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}

/** Rows of a menu in one card, with lines between them. */
export function Menu({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.line }]}>
      {Children.toArray(children).map((row, index) => (
        <Fragment key={index}>
          {index > 0 && <View style={[styles.menuLine, { backgroundColor: c.line }]} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** A labelled text field. */
export function Field({ label, style, ...input }: { label: string } & TextInputProps) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      {/* A caller's style adds to the box (a taller description), it does not replace its border and colours. */}
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} style={[styles.input, { borderColor: c.line, color: c.fg, backgroundColor: c.surface }, style]} {...input} />
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
      {state === "loading" && <MarkLoader label="loading" color={c.logo} />}
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
  button: { minHeight: 48, borderRadius: radius.md, flexDirection: "row", gap: space.sm, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  buttonText: { fontSize: 16, fontWeight: "600" },
  dim: { opacity: 0.7 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 36, justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  track: { flexDirection: "row", borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  chipLine: { flexDirection: "row", gap: space.sm },
  menu: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, minHeight: 56 },
  menuIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  menuText: { flex: 1, fontSize: 16 },
  menuLine: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  field: { gap: space.xs },
  label: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: space.md, fontSize: 16 },
  heading: { fontSize: 22, fontWeight: "700" },
  note: { fontSize: 14, lineHeight: 20 },
  state: { padding: space.xl, gap: space.lg, alignItems: "center" },
});
