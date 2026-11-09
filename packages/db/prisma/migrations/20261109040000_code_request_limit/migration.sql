-- CreateTable
CREATE TABLE "CodeRequestLimit" (
    "ipHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeRequestLimit_pkey" PRIMARY KEY ("ipHash")
);
