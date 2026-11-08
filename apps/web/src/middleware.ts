import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@mteam/shared/i18n";

/** Sends paths without a language prefix to the default (Georgian) version. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first] = pathname.split("/");
  if (isLocale(first)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
