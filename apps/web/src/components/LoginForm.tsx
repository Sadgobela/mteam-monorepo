"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "antd";
import type { Dict, Locale } from "@mteam/shared";
import { loginAction, type LoginState } from "@/lib/auth-actions";

type Action = (previous: LoginState, form: FormData) => Promise<LoginState>;

/** A phone number, then the code sent to it. Signs in by default; adding a phone to an account uses the same steps. */
export function LoginForm({ locale, t, next, action: submit = loginAction, verifyLabel = t.login.verify }: { locale: Locale; t: Dict; next?: string; action?: Action; verifyLabel?: string }) {
  const [state, action, pending] = useActionState(submit, {});
  const [code, setCode] = useState("");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.done) window.location.assign(state.done);
  }, [state.done]);

  // Each code step starts empty. After a wrong code the digits stay, to be corrected.
  useEffect(() => setCode(""), [state.phone]);

  return (
    <form ref={form} className="form" action={action}>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      {state.phone ? (
        <>
          <input type="hidden" name="phone" value={state.phone} />
          <input type="hidden" name="code" value={code} />
          <p className="meta">
            {t.login.codeSent} <b className="nowrap">{state.phone}</b>
          </p>
          <div className="field">
            <small id="login-code">{t.login.code}</small>
            <Input.OTP
              aria-labelledby="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              disabled={pending}
              formatter={(text) => text.replace(/\D/g, "")}
              onInput={(cells) => setCode(cells.join(""))}
              // All six digits in: sign in without another click.
              onChange={(value) => {
                setCode(value);
                requestAnimationFrame(() => form.current?.requestSubmit());
              }}
            />
          </div>
          <button className="btn" type="submit" disabled={pending || code.length < 6}>{verifyLabel}</button>
          <button className="link-button" type="submit" name="change" value="1" formNoValidate>{t.login.change}</button>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="login-phone"><small>{t.login.phone}</small></label>
            <span className="phone-input">
              <span aria-hidden="true">+995</span>
              <input id="login-phone" name="phone" type="tel" required autoComplete="tel-national" inputMode="tel" placeholder="5XX XX XX XX" autoFocus />
            </span>
          </div>
          <button className="btn" type="submit" disabled={pending}>{t.login.send}</button>
        </>
      )}
      {state.error && <p className="note" role="alert">{t.login.errors[state.error]}</p>}
    </form>
  );
}
