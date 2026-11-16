"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Tabs } from "antd";
import type { Dict, Locale } from "@mteam/shared";
import { emailSignInAction, registerAction, type AuthState } from "@/lib/password-actions";
import { SubmitButton } from "./SubmitButton";

type Action = (previous: AuthState, form: FormData) => Promise<AuthState>;

/** A form for one of the email and password actions, with its answer under the button. */
export function AuthForm({ action, t, submit, children }: { action: Action; t: Dict; submit: string; children: ReactNode }) {
  const [state, run, pending] = useActionState(action, {});

  useEffect(() => {
    if (state.done) window.location.assign(state.done);
  }, [state.done]);

  // Submitted by hand rather than through the form's action, which would empty what was typed after an error.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => run(data));
  };

  return (
    <form className="form" onSubmit={onSubmit}>
      {children}
      <SubmitButton pending={pending}>{submit}</SubmitButton>
      {state.error && <p className="note" role="alert">{t.auth.errors[state.error]}</p>}
      {state.notice && <p className="note" role="status">{t.auth.notices[state.notice]}</p>}
    </form>
  );
}

/** A labelled password field. A new password gets the rule under it and the browser's password suggestion. */
export function PasswordField({ id, name, label, hint }: { id: string; name: string; label: string; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}><small>{label}</small></label>
      <input id={id} name={name} type="password" required maxLength={128} minLength={hint ? 10 : undefined} autoComplete={hint ? "new-password" : "current-password"} aria-describedby={hint && `${id}-hint`} />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

export function EmailField({ id, label }: { id: string; label: string }) {
  return (
    <div className="field">
      <label htmlFor={id}><small>{label}</small></label>
      <input id={id} name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" />
    </div>
  );
}

/** Sign in with email and password, or create an account with them. Afterwards the page it came from opens. */
export function EmailLoginForm({ locale, t, next }: { locale: Locale; t: Dict; next?: string }) {
  const [register, setRegister] = useState(false);
  return (
    <>
      {/* A fresh form for each mode, so an answer from the other one does not linger. */}
      <AuthForm key={String(register)} action={register ? registerAction : emailSignInAction} t={t} submit={register ? t.auth.register : t.auth.signIn}>
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}
        <EmailField id="login-email" label={t.auth.email} />
        <PasswordField id="login-password" name="password" label={t.auth.password} hint={register ? t.auth.passwordHint : undefined} />
      </AuthForm>
      <div className="auth-links">
        <button type="button" className="link-button" onClick={() => setRegister(!register)}>
          {register ? t.auth.toSignIn : t.auth.toRegister}
        </button>
        {!register && <a className="link-button" href={`/${locale}/auth/reset`}>{t.auth.forgot}</a>}
      </div>
    </>
  );
}

/** The two ways to sign in that happen on this site: a phone code, or an email and password. */
export function LoginTabs({ t, phone, email }: { t: Dict; phone: ReactNode; email: ReactNode }) {
  return (
    <Tabs
      className="login-tabs"
      items={[
        { key: "phone", label: t.auth.tabs.phone, children: phone },
        { key: "email", label: t.auth.tabs.email, children: email },
      ]}
    />
  );
}
