-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

