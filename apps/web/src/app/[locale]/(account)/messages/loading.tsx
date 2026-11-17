import { PageLoader } from "@/components/Loader";
import { HeadingSkeleton, RowsSkeleton } from "@/components/Skeletons";

/** The conversation list, and a conversation opened from elsewhere. */
export default function MessagesLoading() {
  return (
    <main className="account-main" aria-busy="true">
      <PageLoader />
      <HeadingSkeleton />
      <RowsSkeleton count={5} />
    </main>
  );
}
