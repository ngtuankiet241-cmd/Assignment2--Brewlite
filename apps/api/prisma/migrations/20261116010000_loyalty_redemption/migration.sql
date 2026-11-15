ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'LOYALTY';
ALTER TYPE "LoyaltyType" ADD VALUE IF NOT EXISTS 'REFUND';

ALTER TABLE "Order"
ADD COLUMN "redeemedPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyDiscountAmount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "LoyaltyTransaction_orderId_type_key"
ON "LoyaltyTransaction"("orderId", "type");
