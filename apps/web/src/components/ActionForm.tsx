"use client";

import { useOptimistic, type ComponentProps } from "react";
import { unstable_rethrow } from "next/navigation";
import { App } from "antd";
import { FormBusy } from "./SubmitButton";

type Props = Omit<ComponentProps<"form">, "action"> & {
  /** A server action. Returning `false` means it was refused, which reads as a failure. */
  action: (form: FormData) => Promise<unknown>;
  /** Shown when it worked. */
  done?: string;
  /** Shown when it did not, instead of the error page. */
  failed: string;
};

/**
 * A form for a server action that keeps its buttons busy until the action is done, whatever else re-renders meanwhile,
 * and says how it went in a toast. A redirect (to sign in, or to a page that explains) is left to Next.
 */
export function ActionForm({ action, done, failed, children, ...props }: Props) {
  // Optimistic, so it falls back to false by itself when the action settles, thrown or not.
  const [busy, setBusy] = useOptimistic(false);
  const { message } = App.useApp();
  return (
    <form
      {...props}
      action={async (form) => {
        setBusy(true);
        let ok: boolean;
        try {
          ok = (await action(form)) !== false;
        } catch (error) {
          unstable_rethrow(error);
          ok = false;
        }
        if (!ok) message.error(failed);
        else if (done) message.success(done);
      }}
    >
      <FormBusy value={busy}>{children}</FormBusy>
    </form>
  );
}
