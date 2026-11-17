"use client";

import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { EllipsisOutlined, MessageOutlined } from "@ant-design/icons";
import { Button, Dropdown } from "antd";

/**
 * "Write" on a listing: the message box opens from the button instead of always sitting open, and takes the focus. On a
 * phone it grows out of the contact bar at the foot of the screen. The box stays in the page while closed, so a message
 * being typed survives closing it.
 */
export function ChatStart({ label, initialOpen, children }: { label: string; initialOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  const box = useRef<HTMLDivElement>(null);

  function toggle() {
    flushSync(() => setOpen(!open));
    if (!open) ((box.current as HTMLDivElement).querySelector("textarea") as HTMLTextAreaElement).focus();
  }

  return (
    <div className="chat-start" data-open={open ? "" : undefined}>
      <Button className="write-button" aria-expanded={open} icon={<MessageOutlined aria-hidden="true" />} onClick={toggle}>
        {label}
      </Button>
      <div ref={box} className="chat-box">
        {children}
      </div>
    </div>
  );
}

/** Share, hide and report on a phone, gathered behind one button so the listing's head stays calm. */
export function MoreActions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Dropdown trigger={["click"]} placement="bottomRight" popupRender={() => <div className="more-actions">{children}</div>}>
      <Button className="more-actions-button" aria-label={label} icon={<EllipsisOutlined aria-hidden="true" />} />
    </Dropdown>
  );
}
