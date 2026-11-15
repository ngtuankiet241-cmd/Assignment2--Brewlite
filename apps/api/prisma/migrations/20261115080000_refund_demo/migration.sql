-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "demoBy" TEXT,
ADD COLUMN     "demoCompletedAt" TIMESTAMP(3),
ADD COLUMN     "demoReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Refund_demoReference_key" ON "Refund"("demoReference");
