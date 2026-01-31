-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('competitor_price_drop', 'competitor_price_raise', 'competitor_out_of_stock', 'position_drop', 'position_raise', 'conversion_drop', 'conversion_raise', 'stock_low', 'review_score_drop', 'seasonal_demand', 'manual_trigger');

-- CreateTable
CREATE TABLE "users" (
...