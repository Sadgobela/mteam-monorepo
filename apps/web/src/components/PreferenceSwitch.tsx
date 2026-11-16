"use client";

import { useId, useState, useTransition } from "react";
import { App, Switch } from "antd";
import type { PreferenceKey } from "@mteam/db";
import { setPreferenceAction } from "@/lib/settings-actions";

/** One setting that saves as soon as it is flipped, says `saved` when it did, and flips back with a note if saving failed. */
export function PreferenceSwitch({ name, label, hint, checked, failed, saved }: { name: PreferenceKey; label: string; hint?: string; checked: boolean; failed: string; saved?: string }) {
  const [on, setOn] = useState(checked);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const { message } = App.useApp();
  const change = (next: boolean) => {
    setOn(next);
    setError(false);
    startTransition(async () => {
      // A thrown error (the database, or an account deleted meanwhile) counts as a failed save, not a crash.
      if (await setPreferenceAction(name, next).catch(() => false)) {
        if (saved) message.success(saved);
        return;
      }
      setOn(!next);
      setError(true);
    });
  };
  return (
    <div className="settings-row">
      <label htmlFor={id}>
        {label}
        {hint && <span className="settings-hint" id={`${id}-hint`}>{hint}</span>}
      </label>
      <Switch id={id} checked={on} loading={pending} onChange={change} aria-describedby={hint ? `${id}-hint` : undefined} />
      {error && <p className="note settings-error" role="alert">{failed}</p>}
    </div>
  );
}
