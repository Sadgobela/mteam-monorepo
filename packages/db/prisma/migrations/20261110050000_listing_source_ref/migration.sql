ALTER TABLE "Listing" ADD COLUMN "sourceRef" TEXT;

CREATE UNIQUE INDEX "Listing_sourceRef_key" ON "Listing"("sourceRef");
