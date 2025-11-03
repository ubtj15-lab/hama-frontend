/*
  Warnings:

  - You are about to drop the column `status` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `ts` on the `Reservation` table. All the data in the column will be lost.
  - Added the required column `address` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `placeName` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "placeId" TEXT,
    "placeName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phonePlace" TEXT,
    "x" TEXT,
    "y" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL DEFAULT 2,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "memo" TEXT,
    "source" TEXT
);
INSERT INTO "new_Reservation" ("createdAt", "id", "name") SELECT "createdAt", "id", "name" FROM "Reservation";
DROP TABLE "Reservation";
ALTER TABLE "new_Reservation" RENAME TO "Reservation";
CREATE INDEX "Reservation_createdAt_idx" ON "Reservation"("createdAt");
CREATE INDEX "Reservation_placeId_idx" ON "Reservation"("placeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
