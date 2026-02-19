/*
  Warnings:

  - You are about to drop the column `isActive` on the `ClientStory` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `ClientStory` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `ClientStory` table. All the data in the column will be lost.
  - Added the required column `clientName` to the `ClientStory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `propertyName` to the `ClientStory` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ClientStory_isActive_idx";

-- AlterTable
ALTER TABLE "ClientStory" DROP COLUMN "isActive",
DROP COLUMN "name",
DROP COLUMN "role",
ADD COLUMN     "clientName" TEXT NOT NULL,
ADD COLUMN     "clientTitle" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "propertyName" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ClientStory_isHidden_idx" ON "ClientStory"("isHidden");
