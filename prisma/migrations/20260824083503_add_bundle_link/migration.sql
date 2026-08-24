-- CreateTable
CREATE TABLE "BundleLink" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "bundleVariantId" TEXT NOT NULL,
    "componentVariantId" TEXT NOT NULL,
    "quantityNeeded" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleLink_shop_bundleVariantId_idx" ON "BundleLink"("shop", "bundleVariantId");
