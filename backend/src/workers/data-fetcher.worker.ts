import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from '@/utils/logger';
import prisma from '@/config/database.config';
import { WBApiClient } from '@/services/wb-api/WBApiClient';
import { SignalProcessor } from '@/core/signal-processor/SignalProcessor';
import type { FetchDataJobPayload } from '@/queue/QueueManager';
import { SignalType } from '@shared/types/signal.types';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

const logger = new Logger('DataFetcherWorker');

/**
 * Worker для сбора данных с WB API
 * Запускается периодически (каждые 30 минут)
 */
const worker = new Worker<FetchDataJobPayload>(
  'fetch-data',
  async (job: Job<FetchDataJobPayload>) => {
    logger.info(`Processing fetch data job ${job.id}`, job.data);

    const { userId, skuIds } = job.data;

    try {
      // 1. Получаем пользователя и его API ключ
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || !user.wbApiKey) {
        throw new Error(`User ${userId} not found or has no WB API key`);
      }

      // 2. Создаём клиент WB API
      const wbClient = new WBApiClient(user.wbApiKey);

      // 3. Получаем список SKU для обработки
      const skusToProcess = await getSKUsToProcess(userId, skuIds);

      logger.info(`Processing ${skusToProcess.length} SKUs for user ${userId}`);

      // 4. Обрабатываем каждый SKU
      for (const sku of skusToProcess) {
        try {
          await processSKU(sku, wbClient);
          await job.updateProgress(
            ((skusToProcess.indexOf(sku) + 1) / skusToProcess.length) * 100
          );
        } catch (error: any) {
          logger.error(`Failed to process SKU ${sku.id}`, {
            error: error.message
          });
          // Продолжаем обработку остальных SKU
        }
      }

      logger.info(`Fetch data job ${job.id} completed`);
      return { processed: skusToProcess.length };

    } catch (error: any) {
      logger.error(`Fetch data job ${job.id} failed`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Обрабатываем 2 задачи параллельно
    limiter: {
      max: 10,
      duration: 60000 // Максимум 10 задач в минуту
    }
  }
);

/**
 * Получить список SKU для обработки
 */
async function getSKUsToProcess(userId: string, skuIds?: string[]) {
  if (skuIds && skuIds.length > 0) {
    return prisma.sKU.findMany({
      where: {
        userId,
        id: { in: skuIds },
        active: true
      }
    });
  }

  // Если не указаны конкретные SKU - берём все активные
  return prisma.sKU.findMany({
    where: {
      userId,
      active: true
    }
  });
}

/**
 * Обработать один SKU
 */
async function processSKU(sku: any, wbClient: WBApiClient) {
  logger.debug(`Processing SKU ${sku.wbSkuId}`);

  const nmId = Number(sku.wbSkuId);

  // 1. Получаем актуальную информацию о товаре через наш API
  const product = await wbClient.getProduct(nmId);
  if (product) {
    await prisma.sKU.update({
      where: { id: sku.id },
      data: { currentPrice: product.priceWithDiscount }
    });
  }

  // 2. Парсим цены конкурентов
  const { WBMarketParser } = await import('@/services/wb-api/WBMarketParser');
  const parser = new WBMarketParser();
  const marketPriceData = await parser.getCompetitorPrices(nmId);

  if (!marketPriceData) {
    logger.warn(`No market data returned for SKU ${sku.wbSkuId}`);
    return;
  }

  // 3. Читаем предыдущие market data для сравнения сигналов
  const prevMarketData = await prisma.marketData.findFirst({
    where: { skuId: sku.id },
    orderBy: { fetchedAt: 'desc' }
  });

  // 4. Сохраняем новые market data в БД
  await prisma.marketData.create({
    data: {
      skuId: sku.id,
      competitors: marketPriceData.competitors,
      minPrice: marketPriceData.minPrice,
      maxPrice: marketPriceData.maxPrice,
      medianPrice: marketPriceData.medianPrice,
    }
  });

  logger.info(`Market data saved for SKU ${sku.wbSkuId}`, {
    minPrice: marketPriceData.minPrice,
    maxPrice: marketPriceData.maxPrice,
    medianPrice: marketPriceData.medianPrice,
    competitorCount: marketPriceData.competitorCount
  });

  // 5. Генерируем сигналы при существенных изменениях
  if (prevMarketData) {
    const oldMin = Number(prevMarketData.minPrice);
    const newMin = marketPriceData.minPrice;

    // Падение минимальной цены конкурента больше чем на 3%
    if (oldMin > 0 && newMin < oldMin && ((oldMin - newMin) / oldMin) > 0.03) {
      await SignalProcessor.createSignal(
        sku.id,
        SignalType.COMPETITOR_PRICE_DROP,
        {
          oldMinPrice: oldMin,
          newMinPrice: newMin,
          dropPercent: (((oldMin - newMin) / oldMin) * 100).toFixed(1),
        }
      );
      logger.info(`COMPETITOR_PRICE_DROP signal created for SKU ${sku.wbSkuId}`, {
        oldMin, newMin
      });
    }

    // Рост минимальной цены больше чем на 5%
    const oldMax = Number(prevMarketData.maxPrice);
    const newMax = marketPriceData.maxPrice;
    if (oldMin > 0 && newMin > oldMin && ((newMin - oldMin) / oldMin) > 0.05) {
      await SignalProcessor.createSignal(
        sku.id,
        SignalType.COMPETITOR_PRICE_RISE,
        {
          oldMinPrice: oldMin,
          newMinPrice: newMin,
          risePercent: (((newMin - oldMin) / oldMin) * 100).toFixed(1),
        }
      );
      logger.info(`COMPETITOR_PRICE_RISE signal created for SKU ${sku.wbSkuId}`, {
        oldMin, newMin
      });
    }
  }

  logger.debug(`SKU ${sku.wbSkuId} processed successfully`);
}

// Event handlers
worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed`, job.returnvalue);
});

worker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed`, {
    error: err.message,
    data: job?.data
  });
});

worker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker...');
  await worker.close();
  await connection.quit();
  process.exit(0);
});

logger.info('Data Fetcher Worker started');

export default worker;
