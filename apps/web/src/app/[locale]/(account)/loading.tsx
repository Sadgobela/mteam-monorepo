import { PageLoader } from "@/components/Loader";
import { HeadingSkeleton, RowsSkeleton } from "@/components/Skeletons";

/** Shown inside the account area's sidebar while one of its pages loads. */
export default function AccountLoading() {
  return (
    <main className="account-main" aria-busy="true">
      <PageLoader />
      <HeadingSkeleton />
      <RowsSkeleton />
    </main>
  );
}
