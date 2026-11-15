ALTER TABLE "Order"
ADD COLUMN "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "promotionCode" TEXT;

-- Existing orders retain their payable total and have no recorded discount.
UPDATE "Order" SET "subtotalAmount" = "totalAmount";
UPDATE "Order" AS o SET "promotionCode" = p."code"
FROM "Promotion" AS p WHERE o."promotionId" = p."id";
