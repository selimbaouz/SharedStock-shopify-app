-- AlterTable
ALTER TABLE "BundleLink" ADD COLUMN "componentInventoryItemId" TEXT;

-- CreateIndex
CREATE INDEX "BundleLink_shop_componentInventoryItemId_idx" ON "BundleLink"("shop", "componentInventoryItemId");
