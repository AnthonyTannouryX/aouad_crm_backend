/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `ClientStory` table. All the data in the column will be lost.
  - You are about to drop the column `propertyName` on the `ClientStory` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `ClientStory` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ClientStory_sortOrder_idx";

-- AlterTable
ALTER TABLE "ClientStory" DROP COLUMN "imageUrl",
DROP COLUMN "propertyName",
DROP COLUMN "sortOrder";
