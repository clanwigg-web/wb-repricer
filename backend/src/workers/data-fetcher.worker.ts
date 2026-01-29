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

  // 1. Получаем актуальную информацию о товаре
  const product = await wbClient.getProduct(Number(sku.wbSkuId));

  if (!product) {
    logger.warn(`Product ${sku.wbSkuId} not found on WB`);
    return;
  }

  // 2. Сохраняем старые значения для сравнения
  const oldPrice = Number(sku.currentPrice);
  const oldPosition = sku.position;

  // 3. Обновляем данные в БД
  await prisma.sKU.update({
    where: { id: sku.id },
    data: {
      currentPrice: product.priceWithDiscount,
      // position будет обновляться через отдельный механизм
    }
  });

  // 4. Генерируем сигналы при изменениях

  // Изменение цены конкурентов (упрощённо - используем market_data)
  const marketData = await prisma.marketData.findFirst({
    where: { skuId: sku.id },
    orderBy: { fetchedAt: 'desc' }
  });

  if (marketData) {
    const oldMinPrice = Number(marketData.minPrice);
    
    // TODO: Получить актуальные цены конкурентов
    // Пока используем заглушку
    const newMinPrice = oldMinPrice; // В реальности - из парсинга

    if (newMinPrice < oldMinPrice) {
      await SignalProcessor.createSignal(
        sku.id,
        SignalType.COMPETITOR_PRICE_DROP,
        {
          oldPrice: oldMinPrice,
          newPrice: newMinPrice,
          priceChange: newMinPrice - oldMinPrice,
          priceChangePercent: ((newMinPrice - oldMinPrice) / oldMinPrice) * 100
        }
      );
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
