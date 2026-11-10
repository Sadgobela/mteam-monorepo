CREATE TABLE "HiddenListing" (
    "userId" TEXT NOT NULL,
    "listingId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HiddenListing_pkey" PRIMARY KEY ("userId","listingId")
);

CREATE TABLE "ListingReport" (
    "id" TEXT NOT NULL,
    "listingId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "ipHash" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingReport_listingId_ipHash_key" ON "ListingReport"("listingId", "ipHash");

ALTER TABLE "HiddenListing" ADD CONSTRAINT "HiddenListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HiddenListing" ADD CONSTRAINT "HiddenListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
