CREATE TYPE "StockReservationStatus" AS ENUM ('HELD', 'CONSUMED', 'RELEASED');

ALTER TABLE "Product" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK ("stock" >= 0);

-- Existing orders did not reserve stock; leave their reservation fields NULL.
ALTER TABLE "Order"
  ADD COLUMN "reservationStatus" "StockReservationStatus",
  ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);

CREATE INDEX "Order_reservationStatus_reservationExpiresAt_idx"
  ON "Order"("reservationStatus", "reservationExpiresAt");
