"use client";

import { useState } from "react";
import { Button } from "antd";
import type { Dict } from "@mteam/shared";

/** The phone's own share sheet where there is one; otherwise the link is copied. */
export function ShareButton({ title, t }: { title: string; t: Dict }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if ("share" in navigator) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await (navigator as Navigator).clipboard.writeText(url);
    setCopied(true);
  }

  return <Button onClick={share}>{copied ? t.listing.copied : t.listing.share}</Button>;
}
