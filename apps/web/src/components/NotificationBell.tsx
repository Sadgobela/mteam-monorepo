"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Dict, Locale } from "@mteam/shared";
import "@/app/notifications.css";

const MOST_SHOWN = 9;

/**
 * The header's bell, linking to the notifications page. The unread count comes as a promise the server streams in,
 * so counting never holds up the page; the badge is hidden at zero and when counting fails.
 */
export function NotificationBell({ locale, labels, unread }: { locale: Locale; labels: Pick<Dict["notifications"], "bell" | "bellUnread">; unread: Promise<number> }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    unread.then(setCount, () => setCount(0));
  }, [unread]);
  return (
    <Link href={`/${locale}/account/notifications`} className="bell" aria-label={count > 0 ? labels.bellUnread.replace("{count}", String(count)) : labels.bell}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="bell-count" aria-hidden="true">
          {count > MOST_SHOWN ? `${MOST_SHOWN}+` : count}
        </span>
      )}
    </Link>
  );
}
