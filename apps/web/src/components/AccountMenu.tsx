"use client";

import Link from "next/link";
import { Button, Dropdown } from "antd";

/** A signed-in user's own pages, in one menu so the header stays on one line. */
export function AccountMenu({ label, links }: { label: string; links: { href: string; text: string }[] }) {
  const items = links.map(({ href, text }) => ({ key: href, label: <Link href={href}>{text}</Link> }));
  return (
    <Dropdown trigger={["click"]} menu={{ items }}>
      <Button className="lang-button">{label}</Button>
    </Dropdown>
  );
}
