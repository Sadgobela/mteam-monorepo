import { CardGridSkeleton, HeadingSkeleton } from "@/components/Skeletons";

export default function FavoritesLoading() {
  return (
    <main className="account-main" aria-busy="true">
      <HeadingSkeleton />
      <CardGridSkeleton count={4} />
    </main>
  );
}
