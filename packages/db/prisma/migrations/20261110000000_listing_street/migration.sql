-- A street chosen from the list, so listings can be searched by exact street. The address stays what the owner typed.
ALTER TABLE "Listing" ADD COLUMN "street" TEXT;
