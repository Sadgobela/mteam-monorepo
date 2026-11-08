-- Prices come in several currencies, so search and sorting use a USD figure at the application's fixed rates.
ALTER TABLE "Listing" ADD COLUMN "priceUsd" INTEGER;
UPDATE "Listing" SET "priceUsd" = ROUND("price" / CASE "currency" WHEN 'GEL' THEN 2.7 WHEN 'AED' THEN 3.6725 ELSE 1 END);
ALTER TABLE "Listing" ALTER COLUMN "priceUsd" SET NOT NULL;

DROP INDEX "Listing_price_idx";
CREATE INDEX "Listing_priceUsd_idx" ON "Listing"("priceUsd");
