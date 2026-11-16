CREATE TABLE "ExchangeRate" (
    "currency" TEXT NOT NULL,
    "gelPerUnit" DOUBLE PRECISION NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("currency")
);
