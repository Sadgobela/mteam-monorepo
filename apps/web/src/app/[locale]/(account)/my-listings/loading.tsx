import { PageLoader } from "@/components/Loader";
import { HeadingSkeleton, RowsSkeleton } from "@/components/Skeletons";

export default function MyListingsLoading() {
  return (
    <main className="account-main narrow" aria-busy="true">
      <PageLoader />
      <HeadingSkeleton />
      <RowsSkeleton thumb />
    </main>
  );
}
