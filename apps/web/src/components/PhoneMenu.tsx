"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

/** The header's links on a phone. It sits in the page flow, so there is no overlay to dismiss. */
export function PhoneMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // The header survives a same-page navigation such as ?deal=rent, so it has to close itself.
  function closeAfterLeaving(event: MouseEvent) {
    if ((event.target as Element).closest("a")) setOpen(false);
  }

  return (
    <div className="phone-menu">
      <button type="button" className="btn ghost" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        ☰
      </button>
      {open && (
        // Closed on submit, not on the button's click: removing the form before the browser submits it cancels the submit.
        <div className="menu-panel" onClick={closeAfterLeaving} onSubmit={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
