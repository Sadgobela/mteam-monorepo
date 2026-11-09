"use client";

import Link from "next/link";
import { Pagination } from "antd";
import type { Dict, Locale } from "@mteam/shared";
import { resultsHref, type Query } from "@/lib/url";

export function Pager({ locale, t, query, page, total, size }: { locale: Locale; t: Dict; query: Query; page: number; total: number; size: number }) {
  const last = Math.ceil(total / size);
  return (
    <nav className="pager" aria-label={t.results.pages}>
      <Pagination
        align="center"
        current={page}
        total={total}
        pageSize={size}
        showSizeChanger={false}
        itemRender={(target, type) => {
          if ((type === "prev" && page === 1) || (type === "next" && page === last)) return null;
          const text = type === "page" ? target : type === "prev" ? t.results.previous : type === "next" ? t.results.next : "…";
          return <Link href={resultsHref(locale, query, { page: String(target) })}>{text}</Link>;
        }}
      />
    </nav>
  );
}
