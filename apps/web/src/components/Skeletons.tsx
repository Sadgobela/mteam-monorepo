"use client";

import { Skeleton } from "antd";
import { Logo } from "./Logo";

// Stand-ins shown while a page loads: the shapes of what is coming, with no text, since a loading file gets no language.
// The shapes are hidden from screen readers; the busy page around them says something is on its way.

/** The site header's frame with the logo, for pages that draw their own header. */
export function HeaderSkeleton() {
  return (
    <header className="nav" aria-hidden="true">
      <div className="nav-main">
        <span className="brand">
          <Logo />
        </span>
      </div>
    </header>
  );
}

/** Listing cards, as on the home page and in results. */
export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="cards" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card skeleton-card">
          <div className="ph skeleton-block" />
          <div className="cbody">
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A list of rows, as in my listings, messages and the other account pages; `thumb` adds a photo to each. */
export function RowsSkeleton({ count = 4, thumb = false }: { count?: number; thumb?: boolean }) {
  return (
    <ul className="mine skeleton-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          {thumb && <div className="skeleton-block skeleton-thumb" />}
          <Skeleton active title={{ width: "40%" }} paragraph={{ rows: 1, width: "70%" }} />
        </li>
      ))}
    </ul>
  );
}

/** A page heading. */
export function HeadingSkeleton() {
  return <Skeleton.Input active size="large" className="skeleton-heading" />;
}

/** The listing page: photos, then its text beside the price and contact box. */
export function ListingSkeleton() {
  return (
    <main className="listing" aria-busy="true">
      <div className="skeleton-block skeleton-gallery" />
      <div className="lhead">
        <Skeleton active title={{ width: "60%" }} paragraph={{ rows: 1, width: "40%" }} />
      </div>
      <aside className="side">
        <div className="agent">
          <Skeleton active paragraph={{ rows: 3 }} />
        </div>
      </aside>
      <div>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    </main>
  );
}
