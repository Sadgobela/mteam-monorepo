-- MTeam now serves Georgia only. Dubai listings go first, or dropping AED below would fail on them.
DELETE FROM "Listing" WHERE "currency" = 'AED' OR "city" = 'დუბაი';

-- Postgres cannot drop an enum value, so the type is replaced.
CREATE TYPE "Currency_new" AS ENUM ('USD', 'GEL');
ALTER TABLE "Listing" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "Listing" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TYPE "Currency" RENAME TO "Currency_old";
ALTER TYPE "Currency_new" RENAME TO "Currency";
DROP TYPE "Currency_old";
ALTER TABLE "Listing" ALTER COLUMN "currency" SET DEFAULT 'USD';
