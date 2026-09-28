-- CreateEnum
CREATE TYPE "PostcardStatus" AS ENUM ('SUBMITTED', 'READY');

-- CreateTable
CREATE TABLE "Postcard" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "photoPath" TEXT NOT NULL,
    "photoWidthPx" INTEGER NOT NULL,
    "photoHeightPx" INTEGER NOT NULL,
    "targetMindPath" TEXT,
    "videoPath" TEXT,
    "status" "PostcardStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Postcard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Postcard_slug_key" ON "Postcard"("slug");
