import { HeadingSkeleton, RowsSkeleton } from "@/components/Skeletons";

export default function MyListingsLoading() {
  return (
    <main className="account-main narrow" aria-busy="true">
      <HeadingSkeleton />
      <RowsSkeleton thumb />
    </main>
  );
}
