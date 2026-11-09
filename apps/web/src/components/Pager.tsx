"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pagination } from "antd";
import type { Dict, Locale } from "@mteam/shared";
import { resultsHref, type Query } from "@/lib/url";

export function Pager({ locale, t, query, page, total, size }: { locale: Locale; t: Dict; query: Query; page: number; total: number; size: number }) {
  const router = useRouter();
  const last = Math.ceil(total / size);
  const hrefFor = (target: number) => resultsHref(locale, query, { page: String(target) });
  return (
    <nav className="pager" aria-label={t.results.pages}>
      <Pagination
        align="center"
        current={page}
        total={total}
        pageSize={size}
        showSizeChanger={false}
        // For the keyboard: Ant makes each item a tab stop that only reports its page.
        onChange={(target) => router.push(hrefFor(target))}
        itemRender={(target, type) => {
          if ((type === "prev" && page === 1) || (type === "next" && page === last)) return null;
          const text = type === "page" ? target : type === "prev" ? t.results.previous : type === "next" ? t.results.next : "…";
          return (
            // Stopped so that the item's own handler does not navigate a second time.
            <Link href={hrefFor(target)} onClick={(event) => event.stopPropagation()}>
              {text}
            </Link>
          );
        }}
      />
    </nav>
  );
}
