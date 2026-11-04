/*
  Warnings:

  - You are about to drop the column `lastReminderAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `reminderHour` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `remindersEnabled` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "StudyKind" AS ENUM ('DSA', 'SYSTEM_DESIGN');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "lastReminderAt",
DROP COLUMN "reminderHour",
DROP COLUMN "remindersEnabled";

-- CreateTable
CREATE TABLE "StudyItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "StudyKind" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "platform" "Platform",
    "identifier" TEXT,
    "difficulty" "Difficulty",
    "topic" TEXT,
    "note" TEXT,
    "targetDate" DATE,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyItem_userId_order_idx" ON "StudyItem"("userId", "order");

-- AddForeignKey
ALTER TABLE "StudyItem" ADD CONSTRAINT "StudyItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
