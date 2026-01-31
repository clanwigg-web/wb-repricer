-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('competitor_price_drop', 'competitor_price_raise', 'competitor_out_of_stock', 'position_drop', 'position_raise', 'conversion_drop', 'conversion_raise', 'stock_low', 'review_score_drop', 'seasonal_demand', 'manual_trigger');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "wbApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wbSkuId" TEXT NOT NULL,
    "name" TEXT,
    "currentPrice" DOUBLE PRECISION,
    "costPrice" DOUBLE PRECISION NOT NULL,
    "wbCommission" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "logistics" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "constraints" JSONB NOT NULL,
    "stopConditions" JSONB,
    "allowedSignals" TEXT[],
    "ignoredSignals" TEXT[],
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 360,
    "maxChangesPerDay" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_strategies" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "sku_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "type" "SignalType" NOT NULL,
    "data" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "oldPrice" DOUBLE PRECISION,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "strategyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rejections" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "proposedPrice" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "constraintType" TEXT NOT NULL,
    "constraintValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_data" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "wbSkuId" TEXT NOT NULL,
    "position" INTEGER,
    "competitorPrices" JSONB,
    "avgPrice" DOUBLE PRECISION,
    "minPrice" DOUBLE PRECISION,
    "maxPrice" DOUBLE PRECISION,
    "inStock" BOOLEAN,
    "reviewsCount" INTEGER,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "skus_userId_idx" ON "skus"("userId");

-- CreateIndex
CREATE INDEX "skus_wbSkuId_idx" ON "skus"("wbSkuId");

-- CreateIndex
CREATE UNIQUE INDEX "skus_userId_wbSkuId_key" ON "skus"("userId", "wbSkuId");

-- CreateIndex
CREATE INDEX "strategies_userId_idx" ON "strategies"("userId");

-- CreateIndex
CREATE INDEX "sku_strategies_skuId_idx" ON "sku_strategies"("skuId");

-- CreateIndex
CREATE INDEX "sku_strategies_strategyId_idx" ON "sku_strategies"("strategyId");

-- CreateIndex
CREATE INDEX "sku_strategies_active_idx" ON "sku_strategies"("active");

-- CreateIndex
CREATE UNIQUE INDEX "sku_strategies_skuId_strategyId_key" ON "sku_strategies"("skuId", "strategyId");

-- CreateIndex
CREATE INDEX "signals_skuId_idx" ON "signals"("skuId");

-- CreateIndex
CREATE INDEX "signals_type_idx" ON "signals"("type");

-- CreateIndex
CREATE INDEX "signals_processed_idx" ON "signals"("processed");

-- CreateIndex
CREATE INDEX "signals_priority_idx" ON "signals"("priority");

-- CreateIndex
CREATE INDEX "price_history_skuId_idx" ON "price_history"("skuId");

-- CreateIndex
CREATE INDEX "price_history_createdAt_idx" ON "price_history"("createdAt");

-- CreateIndex
CREATE INDEX "price_rejections_skuId_idx" ON "price_rejections"("skuId");

-- CreateIndex
CREATE INDEX "price_rejections_createdAt_idx" ON "price_rejections"("createdAt");

-- CreateIndex
CREATE INDEX "market_data_skuId_idx" ON "market_data"("skuId");

-- CreateIndex
CREATE INDEX "market_data_wbSkuId_idx" ON "market_data"("wbSkuId");

-- CreateIndex
CREATE INDEX "market_data_createdAt_idx" ON "market_data"("createdAt");

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_strategies" ADD CONSTRAINT "sku_strategies_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_strategies" ADD CONSTRAINT "sku_strategies_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rejections" ADD CONSTRAINT "price_rejections_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_data" ADD CONSTRAINT "market_data_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
