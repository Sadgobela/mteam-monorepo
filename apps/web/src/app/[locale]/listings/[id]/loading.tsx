import { PageLoader } from "@/components/Loader";
import { HeaderSkeleton, ListingSkeleton } from "@/components/Skeletons";

export default function ListingLoading() {
  return (
    <>
      <HeaderSkeleton />
      <ListingSkeleton />
      <PageLoader />
    </>
  );
}
