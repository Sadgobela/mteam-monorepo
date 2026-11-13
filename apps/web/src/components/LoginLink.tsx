"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@mteam/shared";
import { loginPath } from "@/lib/login-path";

type Props = { locale: Locale; className?: string; label?: string; children: ReactNode };

function Here({ locale, className, label, children }: Props) {
  const path = usePathname();
  const query = useSearchParams()?.toString();
  const next = path ? `${path}${query ? `?${query}` : ""}` : `/${locale}`;
  return (
    <Link href={loginPath(locale, next)} className={className} aria-label={label} scroll={false}>
      {children}
    </Link>
  );
}

/** A link to sign in that comes back to the page it was on. Opens as a modal over that page. */
export function LoginLink(props: Props) {
  // Reading the query needs a boundary on pages rendered ahead of time; until then it simply goes home afterwards.
  const fallback = (
    <Link href={`/${props.locale}/login`} className={props.className} aria-label={props.label} scroll={false}>
      {props.children}
    </Link>
  );
  return (
    <Suspense fallback={fallback}>
      <Here {...props} />
    </Suspense>
  );
}
