-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "bankTransactionRef" TEXT,
ADD COLUMN     "evidenceUrl" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "transferRecordedAt" TIMESTAMP(3),
ADD COLUMN     "transferRecordedBy" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Refund_bankTransactionRef_key" ON "Refund"("bankTransactionRef");
