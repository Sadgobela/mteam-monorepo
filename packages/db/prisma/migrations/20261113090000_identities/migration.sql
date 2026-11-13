-- Someone who signs in with Google, Facebook or Apple has no phone until they add one.
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;

CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE', 'FACEBOOK', 'APPLE');

CREATE TABLE "Identity" (
    "provider" "IdentityProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("provider","subject")
);

CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
