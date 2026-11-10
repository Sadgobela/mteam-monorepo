"use client";

import { useState } from "react";
import { Button } from "antd";
import { z } from "zod";
import type { Dict } from "@mteam/shared";

const phoneSchema = z.object({ phone: z.string() });

/** The number is only sent when asked for, so it is not sitting in the page for scrapers. */
export function PhoneReveal({ listingId, masked, t }: { listingId: number; masked: string; t: Dict }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    const response = await fetch(`/api/listings/${listingId}/phone`).catch(() => null);
    setLoading(false);
    if (response?.ok) setPhone(phoneSchema.parse(await response.json()).phone);
  }

  if (phone === null) {
    return (
      <Button type="primary" block loading={loading} onClick={reveal}>
        {masked} · {t.listing.showPhone}
      </Button>
    );
  }
  return (
    <>
      <a className="btn" href={`tel:${phone}`}>
        {phone}
      </a>
      <a className="btn wa" href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
        {t.listing.whatsapp}
      </a>
    </>
  );
}
