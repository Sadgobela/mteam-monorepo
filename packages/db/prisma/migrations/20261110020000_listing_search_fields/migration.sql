CREATE TYPE "BuildingStatus" AS ENUM ('OLD', 'NEW', 'CONSTRUCTION');

ALTER TABLE "Listing" ADD COLUMN "building" "BuildingStatus";
ALTER TABLE "Listing" ADD COLUMN "metro" TEXT;
ALTER TABLE "Listing" ADD COLUMN "pricePerSqmUsd" INTEGER;

-- Stored like priceUsd, so it can be filtered directly.
UPDATE "Listing" SET "pricePerSqmUsd" = LEAST(ROUND("priceUsd" / "area"), 2147483647);
ALTER TABLE "Listing" ALTER COLUMN "pricePerSqmUsd" SET NOT NULL;
