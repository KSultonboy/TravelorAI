-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "categories" TEXT[],
    "tags" TEXT[],
    "budgetDaily" INTEGER NOT NULL,
    "midDaily" INTEGER NOT NULL,
    "luxuryDaily" INTEGER NOT NULL,
    "trainPrice" INTEGER NOT NULL,
    "trainDuration" TEXT NOT NULL,
    "busPrice" INTEGER NOT NULL,
    "busDuration" TEXT NOT NULL,
    "landmarks" JSONB NOT NULL,
    "hotels" JSONB NOT NULL,
    "foodBudget" INTEGER NOT NULL,
    "foodMid" INTEGER NOT NULL,
    "foodLuxury" INTEGER NOT NULL,
    "bestSeasons" TEXT[],
    "minDays" INTEGER NOT NULL,
    "maxDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "perPersonCost" INTEGER NOT NULL,
    "budgetUsed" DOUBLE PRECISION NOT NULL,
    "budgetRemaining" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "travelers" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "planData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
