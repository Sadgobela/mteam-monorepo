-- CreateEnum
CREATE TYPE "UserIntent" AS ENUM ('SEEKING', 'OWNER', 'BROKER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MESSAGE', 'LISTING_APPROVED', 'LISTING_REJECTED', 'LISTING_EXPIRING', 'PRICE_DROP', 'SEARCH_MATCHES');

-- CreateEnum
CREATE TYPE "EmailTokenPurpose" AS ENUM ('VERIFY', 'RESET');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "bio" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "bumpedAt" TIMESTAMP(3),
ADD COLUMN     "cadastralCode" TEXT,
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "descriptionRu" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "hidePhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneReveals" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "hidePhoneDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intent" "UserIntent",
ADD COLUMN     "notifyListingUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPriceDrops" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifySavedSearches" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailToken" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "EmailTokenPurpose" NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "listingId" INTEGER,
    "conversationId" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPriceChange" (
    "id" TEXT NOT NULL,
    "listingId" INTEGER NOT NULL,
    "oldPriceUsd" INTEGER NOT NULL,
    "newPriceUsd" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentInvite" (
    "tokenHash" TEXT NOT NULL,
    "branchId" TEXT,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInvite_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE INDEX "EmailToken_userId_idx" ON "EmailToken"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingPriceChange_listingId_createdAt_idx" ON "ListingPriceChange"("listingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "EmailToken" ADD CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPriceChange" ADD CONSTRAINT "ListingPriceChange_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvite" ADD CONSTRAINT "AgentInvite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvite" ADD CONSTRAINT "AgentInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInvite" ADD CONSTRAINT "AgentInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Owners' listings already published get the 60 days from today; brokers' listings never expire.
UPDATE "Listing" SET "expiresAt" = CURRENT_TIMESTAMP + INTERVAL '60 days' WHERE "status" = 'ACTIVE' AND "agentId" IS NULL;
