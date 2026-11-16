"use client";

import { createContext, useContext, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

/**
 * Whether the surrounding `ActionForm` is being sent. React's own form status is not enough on its own: with React 19.1
 * it drops back to "not pending" as soon as anything else inside the form re-renders (a select, a popover, a spinner).
 */
export const FormBusy = createContext(false);

/** Whether the form around this component is being sent; `pending` is for forms that track it themselves. */
export function useFormBusy(pending?: boolean): boolean {
  const busy = useContext(FormBusy);
  const status = useFormStatus();
  return pending ?? (busy || status.pending);
}

/**
 * A form's submit button. While the form is sent it shows a spinner (drawn in CSS from `aria-busy`, so its name stays
 * the same) and is disabled, so the form cannot be sent twice. Forms submitted by hand, or through `useActionState`,
 * pass their own `pending`.
 */
export function SubmitButton({ pending, className = "btn", disabled, ...props }: ComponentProps<"button"> & { pending?: boolean }) {
  const busy = useFormBusy(pending);
  return <button type="submit" className={className} disabled={disabled || busy} aria-busy={busy || undefined} {...props} />;
}
