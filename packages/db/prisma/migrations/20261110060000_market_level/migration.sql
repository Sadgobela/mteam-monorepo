ALTER TABLE "Listing" ADD COLUMN "marketLevel" INTEGER;

CREATE INDEX "ListingImage_listingId_idx" ON "ListingImage"("listingId");
