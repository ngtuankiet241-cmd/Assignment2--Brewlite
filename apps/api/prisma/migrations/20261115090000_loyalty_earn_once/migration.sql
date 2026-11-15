-- Keep redemption history independent; only earning is unique per order.
CREATE UNIQUE INDEX "LoyaltyTransaction_orderId_earn_key"
ON "LoyaltyTransaction"("orderId")
WHERE "type" = 'EARN' AND "orderId" IS NOT NULL;

CREATE INDEX "LoyaltyTransaction_userId_createdAt_idx"
ON "LoyaltyTransaction"("userId", "createdAt");
