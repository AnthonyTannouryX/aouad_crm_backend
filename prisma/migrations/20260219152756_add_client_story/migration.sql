-- CreateTable
CREATE TABLE "ClientStory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "quote" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientStory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientStory_isActive_idx" ON "ClientStory"("isActive");

-- CreateIndex
CREATE INDEX "ClientStory_sortOrder_idx" ON "ClientStory"("sortOrder");

-- CreateIndex
CREATE INDEX "ClientStory_createdAt_idx" ON "ClientStory"("createdAt");
