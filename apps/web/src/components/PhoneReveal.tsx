"use client";

import { useState } from "react";
import { PhoneOutlined, WhatsAppOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { z } from "zod";
import type { Dict } from "@mteam/shared";

const phoneSchema = z.object({ phone: z.string() });

/** The number is only sent when asked for, so it is not sitting in the page for scrapers. */
export function PhoneReveal({ listingId, masked, t }: { listingId: number; masked: string; t: Dict }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function reveal() {
    setLoading(true);
    const response = await fetch(`/api/listings/${listingId}/phone`).catch(() => null);
    setLoading(false);
    setFailed(!response?.ok);
    if (response?.ok) setPhone(phoneSchema.parse(await response.json()).phone);
  }

  if (phone === null) {
    return (
      <>
        {/* The words are the name; on a phone's contact bar only the icon shows. */}
        <Button type="primary" block loading={loading} icon={<PhoneOutlined aria-hidden="true" />} onClick={reveal}>
          <span className="bar-label">
            {masked} · {t.listing.showPhone}
          </span>
        </Button>
        {failed && <p className="note" role="alert">{t.listing.phoneFailed}</p>}
      </>
    );
  }
  return (
    <>
      <a className="btn" href={`tel:${phone}`}>
        <PhoneOutlined aria-hidden="true" />
        <span className="bar-label">{phone}</span>
      </a>
      <a className="btn wa" href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
        <WhatsAppOutlined aria-hidden="true" />
        <span className="bar-label">{t.listing.whatsapp}</span>
      </a>
    </>
  );
}
