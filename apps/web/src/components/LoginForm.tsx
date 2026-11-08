"use client";

import { useActionState } from "react";
import type { Dict, Locale } from "@mteam/shared";
import { loginAction } from "@/lib/auth-actions";

export function LoginForm({ locale, t }: { locale: Locale; t: Dict }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form className="form" action={action}>
      <input type="hidden" name="locale" value={locale} />
      {state.phone ? (
        <>
          <input type="hidden" name="phone" value={state.phone} />
          <p className="meta">
            {t.login.codeSent} {state.phone}
          </p>
          <label className="field">
            <small>{t.login.code}</small>
            <input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} />
          </label>
          <button className="btn" type="submit" disabled={pending}>{t.login.verify}</button>
          <button className="btn ghost" type="submit" name="change" value="1" formNoValidate>{t.login.change}</button>
        </>
      ) : (
        <>
          <label className="field">
            <small>{t.login.phone}</small>
            <input name="phone" type="tel" required autoComplete="tel-national" />
          </label>
          <button className="btn" type="submit" disabled={pending}>{t.login.send}</button>
        </>
      )}
      {state.error && <p className="note" role="alert">{t.login.errors[state.error]}</p>}
    </form>
  );
}
