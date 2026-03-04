-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "featuredOrder" INTEGER DEFAULT 0;

-- CreateIndex
CREATE INDEX "Listing_featured_featuredOrder_idx" ON "Listing"("featured", "featuredOrder");
