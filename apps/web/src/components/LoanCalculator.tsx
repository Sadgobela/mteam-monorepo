"use client";

import { useState } from "react";
import { LOAN_DEFAULTS, monthlyPayment, type Dict } from "@mteam/shared";

/** A rough monthly figure. The inputs start on typical terms and the visitor can change them. */
export function LoanCalculator({ price, symbol, t }: { price: number; symbol: string; t: Dict }) {
  // Text while editing, so clearing a field leaves it empty instead of snapping to 0.
  const [values, setValues] = useState({ price: String(price), down: String(LOAN_DEFAULTS.down), years: String(LOAN_DEFAULTS.years), rate: String(LOAN_DEFAULTS.rate) });
  const field = (name: keyof typeof values, label: string) => (
    <label className="field">
      <small>{label}</small>
      <input type="number" min={0} step="any" value={values[name]} onChange={(event) => setValues({ ...values, [name]: event.target.value })} />
    </label>
  );
  const monthly = monthlyPayment(Number(values.price), Number(values.down), Number(values.years), Number(values.rate));
  return (
    <section className="loan">
      <h2>{t.listing.loanTitle}</h2>
      <div className="form-row">
        {field("price", t.listing.loanPrice)}
        {field("down", t.listing.loanDown)}
        {field("years", t.listing.loanYears)}
        {field("rate", t.listing.loanRate)}
      </div>
      <p className="loan-result">
        {t.listing.loanMonthly}: <b>{symbol}{new Intl.NumberFormat("en-US").format(monthly)}</b>
      </p>
      <p className="meta">{t.listing.loanNote}</p>
    </section>
  );
}
