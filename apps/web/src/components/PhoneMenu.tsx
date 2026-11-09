"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer } from "antd";

/** The header's links on a phone, in a panel that slides in from the side. */
export function PhoneMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // The header survives a same-page navigation such as ?deal=rent, so it has to close itself.
  function closeAfterLeaving(event: MouseEvent) {
    if ((event.target as Element).closest("a")) setOpen(false);
  }

  return (
    <div className="phone-menu">
      <Button aria-label={label} aria-expanded={open} icon={<MenuOutlined />} onClick={() => setOpen(!open)} />
      <Drawer open={open} onClose={() => setOpen(false)} title={label} size={320}>
        <div className="menu-panel" onClick={closeAfterLeaving} onSubmit={() => setOpen(false)}>
          {children}
        </div>
      </Drawer>
    </div>
  );
}
