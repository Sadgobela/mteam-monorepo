import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LOAN_DEFAULTS, monthlyPayment } from "@mteam/shared";
import { useLocale } from "@/lib/i18n";
import { radius, space, useColors } from "@/lib/theme";
import { Field, Note } from "./ui";

/** A rough monthly figure, as on the site: the inputs start on typical terms and can be changed. */
export function LoanCalculator({ price, symbol }: { price: number; symbol: string }) {
  const c = useColors();
  const { t } = useLocale();
  // Text while editing, so clearing a field leaves it empty instead of snapping to 0.
  const [values, setValues] = useState({ price: String(price), down: String(LOAN_DEFAULTS.down), years: String(LOAN_DEFAULTS.years), rate: String(LOAN_DEFAULTS.rate) });
  const field = (name: keyof typeof values, label: string) => (
    <View style={styles.half}>
      <Field label={label} keyboardType="decimal-pad" value={values[name]} onChangeText={(text) => setValues({ ...values, [name]: text })} />
    </View>
  );
  const monthly = monthlyPayment(Number(values.price), Number(values.down), Number(values.years), Number(values.rate));
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.fg }]}>
        {t.listing.loanTitle}
      </Text>
      <View style={styles.grid}>
        {field("price", `${t.listing.loanPrice}, ${symbol}`)}
        {field("down", t.listing.loanDown)}
        {field("years", t.listing.loanYears)}
        {field("rate", t.listing.loanRate)}
      </View>
      <View style={[styles.result, { backgroundColor: c.brandSoft }]}>
        <Text style={{ color: c.brandDeep }}>{t.listing.loanMonthly}</Text>
        <Text testID="monthly" style={[styles.sum, { color: c.brandDeep }]}>{`${symbol}${new Intl.NumberFormat("en-US").format(monthly)}`}</Text>
      </View>
      <Note>{t.listing.loanNote}</Note>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1 },
  title: { fontSize: 18, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  half: { flexBasis: "45%", flexGrow: 1 },
  result: { borderRadius: radius.md, padding: space.md, gap: 2 },
  sum: { fontSize: 26, fontWeight: "800" },
});
