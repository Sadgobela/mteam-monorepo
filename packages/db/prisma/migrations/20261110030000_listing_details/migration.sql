-- Condition becomes a fixed list. Old values were free text from demo data, so they are cleared rather than mapped.
UPDATE "Listing" SET "condition" = NULL;

ALTER TABLE "Listing" ADD COLUMN "projectType" TEXT;
ALTER TABLE "Listing" ADD COLUMN "bathroom" TEXT;
ALTER TABLE "Listing" ADD COLUMN "storage" TEXT;
ALTER TABLE "Listing" ADD COLUMN "parking" TEXT;
ALTER TABLE "Listing" ADD COLUMN "heating" TEXT;
ALTER TABLE "Listing" ADD COLUMN "hotWater" TEXT;
ALTER TABLE "Listing" ADD COLUMN "material" TEXT;
ALTER TABLE "Listing" ADD COLUMN "windows" TEXT;
ALTER TABLE "Listing" ADD COLUMN "livingRoom" TEXT;
ALTER TABLE "Listing" ADD COLUMN "bedrooms" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "ceiling" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN "yearBuilt" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "features" TEXT[] DEFAULT ARRAY[]::TEXT[];
