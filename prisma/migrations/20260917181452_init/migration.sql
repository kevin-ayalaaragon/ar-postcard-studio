-- CreateTable
CREATE TABLE "Postcard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "photoPath" TEXT NOT NULL,
    "photoWidthPx" INTEGER NOT NULL,
    "photoHeightPx" INTEGER NOT NULL,
    "targetMindPath" TEXT,
    "videoPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Postcard_slug_key" ON "Postcard"("slug");
