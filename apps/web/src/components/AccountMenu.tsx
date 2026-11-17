"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UserOutlined } from "@ant-design/icons";
import { Dropdown, type MenuProps } from "antd";
import type { Locale } from "@mteam/shared";
import { Avatar } from "./Avatar";
import { SubmitButton } from "./SubmitButton";

/** Only what the header shows of the signed-in user. */
export type AccountPerson = { name: string | null; avatarUrl: string | null };

/**
 * The signed-in user's photo in the header, opening their own pages and sign-out. The person comes as a promise the server
 * streams in, like the bell's count; until it arrives, or when the session turns out stale, a plain person icon stands in.
 */
export function AccountMenu({
  label,
  links,
  person,
  locale,
  signOut,
  logout,
}: {
  label: string;
  links: { href: string; text: string }[];
  person: Promise<AccountPerson | null>;
  locale: Locale;
  signOut: string;
  logout: (form: FormData) => Promise<void>;
}) {
  const [who, setWho] = useState<AccountPerson | null>(null);
  const logoutForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    person.then(setWho, () => setWho(null));
  }, [person]);

  const pages = links.map(({ href, text }) => ({ key: href, label: <Link href={href}>{text}</Link> }));
  const items: MenuProps["items"] = [
    // The name heads the menu, as a title rather than something to press.
    ...(who?.name ? [{ key: "who", type: "group" as const, label: who.name, children: pages }] : pages),
    { type: "divider" },
    {
      key: "logout",
      label: (
        <form ref={logoutForm} action={logout} className="menu-form">
          <input type="hidden" name="locale" value={locale} />
          <SubmitButton className="menu-submit">{signOut}</SubmitButton>
        </form>
      ),
    },
  ];

  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        items,
        // A click on the button submits by itself; Enter on the highlighted item, or a click beside the button, lands here.
        onClick: ({ key, domEvent }) => {
          if (key === "logout" && !(domEvent.target as Element).closest("button")) (logoutForm.current as HTMLFormElement).requestSubmit();
        },
      }}
    >
      <button type="button" className="account-button" aria-label={label}>
        {who ? <Avatar name={who.name} url={who.avatarUrl} /> : <UserOutlined aria-hidden="true" />}
      </button>
    </Dropdown>
  );
}
