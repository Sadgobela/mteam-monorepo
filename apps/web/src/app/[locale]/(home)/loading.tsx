import { CardGridSkeleton, HeaderSkeleton } from "@/components/Skeletons";

/**
 * Shown while the home page or a search opens from another page. A new search from the page itself keeps the page and
 * spins its button instead, since only the address's search part changes.
 */
export default function HomeLoading() {
  return (
    <>
      <HeaderSkeleton />
      <main className="page" aria-busy="true">
        <div className="skeleton-block skeleton-search" aria-hidden="true" />
        <CardGridSkeleton />
      </main>
    </>
  );
}
