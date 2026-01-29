import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Logger } from '@/utils/logger';
import { RepriceOrchestrator } from '@/core/reprice-orchestrator/RepriceOrchestrator';
import { WBApiClient } from '@/services/wb-api/WBApiClient';
import prisma from '@/config/database.config';
import type { RepriceJobPayload } from '@/queue/QueueManager';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

const logger = new Logger('RepriceWorker');

/**
 * Worker для репрайсинга
 * Обрабатывает очередь задач на изменение цен
 */
const worker = new Worker<RepriceJobPayload>(
  'reprice',
  async (job: Job<RepriceJobPayload>) => {
    logger.info(`Processing reprice job ${job.id}`, job.data);

    const { skuId, signalId, force } = job.data;

    try {
      // 1. Создаём оркестратор
      const orchestrator = new RepriceOrchestrator();

      // 2. Получаем signal (если есть)
      let signal = null;
      if (signalId) {
        signal = await prisma.signal.findUnique({
          where: { id: signalId }
        });
      }

      // 3. Выполняем репрайсинг
      const result = await orchestrator.reprice(skuId, signal as any);

      if (!result.success) {
        logger.warn(`Reprice failed for SKU ${skuId}`, {
          reason: result.reason,
          error: result.error,
          validationErrors: result.validationErrors
        });

        // Если не критичная ошибка - не бросаем исключение
        if (result.validationErrors) {
          return {
            success: false,
            reason: 'validation_failed',
            details: result
          };
        }

        throw new Error(result.error || 'Reprice failed');
      }

      // 4. Отправляем новую цену в WB API
      const sku = await prisma.sKU.findUnique({
        where: { id: skuId },
        include: { user: true }
      });

      if (sku && sku.user.wbApiKey && result.newPrice) {
        const wbClient = new WBApiClient(sku.user.wbApiKey);
        
        const wbResult = await wbClient.setPrice(
          Number(sku.wbSkuId),
          result.newPrice
        );

        if (!wbResult.success) {
          logger.error(`Failed to update price on WB for SKU ${skuId}`, {
            error: wbResult.error
          });
          
          // Откатываем изменение в БД
          await prisma.sKU.update({
            where: { id: skuId },
            data: { currentPrice: result.oldPrice }
          });

          throw new Error(`Failed to update price on WB: ${wbResult.error}`);
        }

        logger.info(`Price updated on WB for SKU ${skuId}`, {
          oldPrice: result.oldPrice,
          newPrice: result.newPrice
        });
      }

      logger.info(`Reprice job ${job.id} completed successfully`, result);

      return {
        success: true,
        details: result
      };

    } catch (error: any) {
      logger.error(`Reprice job ${job.id} failed`, {
        error: error.message,
        stack: error.stack,
        skuId
      });
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Обрабатываем 5 задач параллельно
    limiter: {
      max: 30,
      duration: 60000 // Максимум 30 изменений цен в минуту
    }
  }
);

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

logger.info('Reprice Worker started');

export default worker;
