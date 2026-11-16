"use client";

import { useOptimistic, type ComponentProps } from "react";
import { FormBusy } from "./SubmitButton";

type Props = Omit<ComponentProps<"form">, "action"> & { action: (form: FormData) => Promise<unknown> };

/** A form for a server action that keeps its buttons busy until the action is done, whatever else re-renders meanwhile. */
export function ActionForm({ action, children, ...props }: Props) {
  // Optimistic, so it falls back to false by itself when the action settles, thrown or not.
  const [busy, setBusy] = useOptimistic(false);
  return (
    <form
      {...props}
      action={async (form) => {
        setBusy(true);
        await action(form);
      }}
    >
      <FormBusy value={busy}>{children}</FormBusy>
    </form>
  );
}
