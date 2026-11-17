import { ScrollView, StyleSheet } from "react-native";
import { LoanCalculator } from "@/components/LoanCalculator";
import { useBarSpace } from "@/components/TabBar";
import { space } from "@/lib/theme";

/** The site's starting price for the calculator on its own page. */
const STARTING_PRICE = 100_000;

/** The mortgage calculator on its own, as on the site's mortgage page. */
export default function MortgageScreen() {
  const barSpace = useBarSpace();
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: barSpace }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <LoanCalculator price={STARTING_PRICE} symbol="$" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ page: { padding: space.lg } });
